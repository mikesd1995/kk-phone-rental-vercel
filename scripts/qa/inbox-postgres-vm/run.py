#!/usr/bin/env python3
"""QA-only, offline guest runner. Assets must already exist; never installs packages."""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parents[3]
SOURCES=["supabase/kk_inbox_v1.sql","supabase/migrations/20261010213000_kk_inbox_private_line_media.sql","supabase/migrations/20261013152000_kk_inbox_durable_outbound_reservations.sql","supabase/migrations/20261013163000_kk_inbox_outbound_owner_review.sql"]

def digest(file): return hashlib.sha256(file.read_bytes()).hexdigest()

def initramfs(root, target):
    with gzip.open(target,'wb',compresslevel=2) as out:
        ino=0
        def entry(name,mode,data=b'',major=0,minor=0,nlink=1):
            nonlocal ino
            ino+=1;name=name.encode()+b'\0'
            values=[ino,mode,0,0,nlink,0,len(data),0,0,major,minor,len(name),0]
            header=b'070701'+b''.join(f'{v:08x}'.encode() for v in values)
            out.write(header+name);out.write(b'\0'*((-(len(header)+len(name)))%4));out.write(data);out.write(b'\0'*((-len(data))%4))
        for file in sorted(root.rglob('*')):
            name=file.relative_to(root).as_posix()
            if name.startswith(('boot/','lib/modules/','.')):continue
            info=file.lstat()
            if stat.S_ISREG(info.st_mode):entry(name,info.st_mode,file.read_bytes())
            elif stat.S_ISLNK(info.st_mode):entry(name,info.st_mode,os.readlink(file).encode())
            elif stat.S_ISDIR(info.st_mode):entry(name,info.st_mode,nlink=2)
        entry('dev/console',stat.S_IFCHR|0o600,major=5,minor=1)
        entry('dev/null',stat.S_IFCHR|0o666,major=1,minor=3)
        entry('TRAILER!!!',0)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tools',required=True,type=Path,help='Absolute directory of pre-provisioned pinned QA assets')
    parser.add_argument('--report',required=True,type=Path)
    parser.add_argument('--negative-control-no-lock',action='store_true',help='Remove advisory locking ONLY in ephemeral guest copies; expected FAIL')
    args=parser.parse_args()
    if not args.tools.is_absolute():parser.error('--tools must be an absolute QA-only path')
    assets=args.tools.resolve()
    ready=json.loads((assets/'kk-qa-assets-ready.json').read_text())
    if ready.get('assets_lock_sha256')!=digest(Path(__file__).parent/'assets.lock.json'):raise RuntimeError('QA assets not fully prepared for this lock')
    lock=json.loads((Path(__file__).parent/'assets.lock.json').read_text())
    for relative,expected in lock['executed_asset_sha256'].items():
        if digest(assets/relative)!=expected:raise RuntimeError('QA asset hash mismatch: '+relative)
    report={'schema_version':'KK_INBOX_NATIVE_VM_ACCEPTANCE_V1','source_hashes':{f:digest(ROOT/f) for f in SOURCES},'executed_source_hashes':{},'harness_hashes':{f:digest(Path(__file__).parent/f) for f in ['run.py','guest-acceptance.sh','assets.lock.json','prepare.py']},'source_modified_for_negative_control':args.negative_control_no_lock,'checks':[],'network_devices':0,'host_shares':0,'production_writes':0,'provider_sends':0,'hosted_postgrest_verified':False,'production_verified':False,'vm_power_loss_verified':False,'release_ready':False,'assets_lock_sha256':digest(Path(__file__).parent/'assets.lock.json')}
    args.report.parent.mkdir(parents=True,exist_ok=True)
    log=args.report.with_suffix('.log')
    with tempfile.TemporaryDirectory(prefix='kk-inbox-native-vm-') as temp:
        work=Path(temp);guest=work/'guest';shutil.copytree(assets/'guest',guest,symlinks=True)
        for directory in ['dev','proc','sys','tmp','run','qa/source']:(guest/directory).mkdir(exist_ok=True,parents=True)
        mutations=0
        for index,file in enumerate(SOURCES):
            data=(ROOT/file).read_bytes()
            if args.negative_control_no_lock:
                mutations+=data.count(b"perform pg_advisory_xact_lock(hashtextextended(p_conversation_id||':'||p_body_fingerprint,0));")
                data=data.replace(b'perform pg_advisory_xact_lock(hashtextextended(p_conversation_id||\':\'||p_body_fingerprint,0));',b'perform 1; -- QA negative control removes the advisory lock')
            (guest/f'qa/source/{index}.sql').write_bytes(data)
            report['executed_source_hashes'][file]=hashlib.sha256(data).hexdigest()
        report['negative_control_mutations']=mutations
        if args.negative_control_no_lock and mutations!=2:raise RuntimeError('Negative control did not remove exactly2 source locks')
        shutil.copyfile(Path(__file__).parent/'guest-acceptance.sh',guest/'qa/accept.sh')
        (guest/'etc/passwd').write_text('root:x:0:0:root:/root:/bin/sh\npostgres:x:70:70:PostgreSQL:/var/lib/postgresql:/bin/sh\n')
        (guest/'etc/group').write_text('root:x:0:\npostgres:x:70:\n')
        for name in ['sh','mount','mkdir','chmod','chown','su','poweroff','sleep','cat','echo','date','ls','id','printf','mkfifo','grep','wc','tr','rm','touch','kill','sync','sed']:
            link=guest/'bin'/name
            if link.is_symlink() or link.is_file():link.unlink()
            link.symlink_to('busybox')
        (guest/'qa/postgresql.conf').write_text("listen_addresses=''\nunix_socket_directories='/run/pg'\nshared_buffers='16MB'\nmax_connections=40\nfsync=on\nsynchronous_commit=on\n")
        (guest/'init').write_text('''#!/bin/sh
export PATH=/usr/libexec/postgresql17:/bin:/sbin:/usr/bin:/usr/sbin
mount -t proc proc /proc || exit 1
mount -t sysfs sysfs /sys || exit 1
mount -t devtmpfs devtmpfs /dev || exit 1
mkdir -p /dev/shm /tmp/pg /run/pg
mount -t tmpfs tmpfs /dev/shm || exit 1
chmod 1777 /tmp
chown -R 70:70 /tmp/pg /run/pg
su -s /bin/sh postgres -c 'initdb -D /tmp/pg -A trust --no-locale -E UTF8 >/tmp/initdb.log 2>&1 && cat /qa/postgresql.conf >>/tmp/pg/postgresql.conf && pg_ctl -D /tmp/pg -l /tmp/pg.log -w start >/dev/null && sh /qa/accept.sh'
status=$?
echo KK_VM_EXIT $status
if [ "$status" != 0 ];then cat /tmp/initdb.log /tmp/pg.log /tmp/holder.err /tmp/waiter.err;fi
poweroff -f
''')
        (guest/'init').chmod(0o755)
        image=work/'acceptance.cpio.gz';initramfs(guest,image)
        host=assets/'host-qemu'
        env={'PATH':'/usr/bin:/bin','LD_LIBRARY_PATH':str(host/'usr/lib/x86_64-linux-gnu')+':'+str(host/'lib/x86_64-linux-gnu'),'QEMU_MODULE_DIR':str(host/'usr/lib/x86_64-linux-gnu/qemu'),'LC_ALL':'C'}
        cmd=[str(host/'usr/bin/qemu-system-x86_64'),'-L',str(host/'usr/share/qemu'),'-no-user-config','-nodefaults','-machine','pc,accel=tcg','-cpu','max','-smp','2','-m','512','-nic','none','-display','none','-monitor','none','-serial','stdio','-no-reboot','-bios',str(host/'usr/share/seabios/bios-256k.bin'),'-kernel',str(assets/'guest/boot/vmlinuz-virt'),'-initrd',str(image),'-append','console=ttyS0 quiet panic=1']
        # No host network, shared filesystem, disk, service URL, credentials or inherited env.
        try:
            with log.open('wb') as out:result=subprocess.run(cmd,env=env,stdin=subprocess.DEVNULL,stdout=out,stderr=subprocess.STDOUT,timeout=300)
            report['qemu_exit_code']=result.returncode
        except subprocess.TimeoutExpired:report['timeout']=True
    for line in log.read_text(errors='replace').splitlines():
        for prefix,key in [('KK_CASE ','checks'),('KK_LOCK ','lock_observations'),('KK_BURST ','burst_observations'),('KK_CRASH ','crash_observations')]:
            if line.startswith(prefix):report.setdefault(key,[]).append(json.loads(line[len(prefix):]))
        if line.startswith('KK_ENGINE '):report['engine']=json.loads(line[len('KK_ENGINE '):])
        if line.startswith('KK_COMPLETE '):report['completion']=json.loads(line[len('KK_COMPLETE '):])
        if line.startswith('KK_VM_EXIT '):report['guest_exit_code']=int(line.split()[-1])
    report['pass']=sum(c['status']=='PASS' for c in report['checks']);report['fail']=sum(c['status']=='FAIL' for c in report['checks'])
    report['technical_pass']=report.get('qemu_exit_code')==0 and report.get('guest_exit_code')==0 and report.get('completion',{}).get('pass')==15 and report['pass']==15 and len({c['name'] for c in report['checks']})==15 and len(report.get('crash_observations',[]))==6 and report['fail']==0 and len({x['pid'] for x in report.get('burst_observations',[])})==8
    report['multi_session_concurrency_verified']=report['technical_pass'] and not args.negative_control_no_lock
    report['postgres_process_crash_recovery_verified']=report['technical_pass'] and not args.negative_control_no_lock
    report['log_sha256']=digest(log)
    report['limitations']=['Native guest PostgreSQL17.11 differs from hosted Supabase17.6','Database lives in guest RAM: process/WAL recovery tested, not VM power loss or disk durability','Storage schema fixture only; hosted PostgREST, actual provider/image/visual and Production release unverified']
    args.report.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ('pass','fail','technical_pass','multi_session_concurrency_verified','postgres_process_crash_recovery_verified')}))
    return 0 if report['technical_pass'] else 1

if __name__=='__main__':raise SystemExit(main())
