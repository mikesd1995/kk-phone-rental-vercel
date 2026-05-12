# v15.5 Poster URL Write Fix

Fixes Admin CRM poster upload flow:
- Create Event: uploaded poster URL is written into the Poster URL field before saving.
- Update Event: adds file upload for existing event poster and writes the uploaded URL into `01_Events!E`.
- Admin success notice confirms when poster URL has been returned from backend.
- Keeps `/admin` and `/admin/` route compatibility from v15.4.
