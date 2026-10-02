# OpenAI staging probe serialization recovery — 2026-10-02

Admin Regression exposed accidental literal `\\n` separators in the staging probe source/test. This patch converts only those generated separators to real newlines.

The zero-write staging architecture remains unchanged: the existing intelligence-health function is reused, the Vercel Hobby function-budget gate is not weakened, customer-data authorization remains disabled by default, and no production/business writes are introduced.
