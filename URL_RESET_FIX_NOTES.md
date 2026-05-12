# v14.11 URL Reset Fix

Fixes package modal URL behavior:

- Opening an event modal sets `?event=EVENT_ID`.
- Closing the package modal always resets the address bar to the clean homepage URL: `/`.
- Refreshing after closing will not reopen the same event modal.
- If an invalid `?event=` value is loaded, the URL is cleaned automatically.

Backend is unchanged from v14.10 COMPAT.
