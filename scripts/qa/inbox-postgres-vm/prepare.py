#!/usr/bin/env python3
"""Explicit QA asset download/extraction. No install, scripts, services or database."""
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tarfile
import urllib.request


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tools',required=True,type=Path,help='New absolute QA-only directory outside repository')
    parser.add_argument('--package-cache',type=Path,help='Optional absolute complete package cache; when supplied no downloads occur')
    args=parser.parse_args();target=args.tools
    if args.package_cache is not None and not args.package_cache.is_absolute():parser.error('--package-cache must be absolute')
    if not target.is_absolute() or target.exists():parser.error('--tools must be a NEW absolute directory')
    repo=Path(__file__).resolve().parents[3]
    if repo==target or repo in target.parents:parser.error('QA assets belong outside application repository')
    lock=json.loads((Path(__file__).parent/'assets.lock.json').read_text())
    target.mkdir(parents=True)
    cache=target/'packages';cache.mkdir()
    ubuntu=lock['ubuntu_packages']
    alpine=[{'name':name,'url':lock['alpine_base_url']+name,'sha256':sha} for name,sha in lock['alpine_package_sha256'].items()]
    def download(item):
        url=item['url']
        if not url.startswith(('https://snapshot.ubuntu.com/ubuntu/20260828T000000Z/','https://dl-cdn.alpinelinux.org/alpine/v3.22/main/x86_64/')):raise RuntimeError('Unapproved QA asset origin')
        file=cache/url.rsplit('/',1)[1]
        if args.package_cache is not None:data=(args.package_cache/file.name).read_bytes()
        else:
            with urllib.request.urlopen(url,timeout=60) as response:data=response.read()
        if hashlib.sha256(data).hexdigest()!=item['sha256']:raise RuntimeError('QA package hash mismatch')
        file.write_bytes(data);return file
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:files=list(pool.map(download,ubuntu+alpine))
    host=target/'host-qemu';host.mkdir();guest=target/'guest';guest.mkdir()
    for file in files[:len(ubuntu)]:subprocess.run(['dpkg-deb','--extract',str(file),str(host)],check=True)
    # Verify pinned archives before extraction. Delay links so no archive member
    # can traverse an archive-created symlink into the host filesystem.
    links=[];hardlinks=[]
    for file in files[len(ubuntu):]:
        with tarfile.open(file,ignore_zeros=True) as archive:
            for member in archive:
                relative=Path(member.name)
                if relative.is_absolute() or '..' in relative.parts:raise RuntimeError('Unsafe APK archive path')
                dest=guest/relative
                if member.isdir():dest.mkdir(parents=True,exist_ok=True)
                elif member.isfile():
                    dest.parent.mkdir(parents=True,exist_ok=True)
                    with archive.extractfile(member) as source:dest.write_bytes(source.read())
                    dest.chmod(member.mode&0o777)
                elif member.issym():links.append((dest,member.linkname))
                elif member.islnk():
                    source=Path(member.linkname)
                    if source.is_absolute() or '..' in source.parts:raise RuntimeError('Unsafe APK hard-link target')
                    hardlinks.append((dest,guest/source))
    while hardlinks:
        pending=[]
        for dest,source in hardlinks:
            if source.is_file() and not source.is_symlink():
                dest.parent.mkdir(parents=True,exist_ok=True)
                if dest.exists():dest.unlink()
                os.link(source,dest)
            else:pending.append((dest,source))
        if len(pending)==len(hardlinks):raise RuntimeError('Unresolved APK hard links')
        hardlinks=pending
    for dest,link in links:
        dest.parent.mkdir(parents=True,exist_ok=True)
        if dest.is_symlink() or dest.is_file():dest.unlink()
        if dest.exists():raise RuntimeError('Archive link would replace directory')
        dest.symlink_to(link)
    for relative,expected in lock['executed_asset_sha256'].items():
        if hashlib.sha256((target/relative).read_bytes()).hexdigest()!=expected:raise RuntimeError('Extracted QA asset mismatch: '+relative)
    (target/'kk-qa-assets-ready.json').write_text(json.dumps({'assets_lock_sha256':hashlib.sha256((Path(__file__).parent/'assets.lock.json').read_bytes()).hexdigest()}))
    print('Pinned QA assets prepared; no package was installed or service started.')

if __name__=='__main__':main()
