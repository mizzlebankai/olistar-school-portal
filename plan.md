# Olistar School Website — Launch and Content Management Plan

## Goal

Launch the school website with a manageable content area for news, events, gallery images, page heroes, and leadership profiles, while keeping the existing school portal and admissions data intact.

## Progress so far

### Completed locally

- Updated the About page with the proprietor's account of the school's early history. Unverified dates and recollections are presented as attributed history rather than independently confirmed facts.
- Added local image fallbacks and page support for managed website content.
- Built the admin content editor and connected published news, events, gallery, leadership, and hero content to the public pages.
- Kept website content in namespaced Firestore collections so it does not overwrite the existing school and admissions collections.
- Built image upload and media-library flows using the public-viewing `school-media` Supabase Storage bucket.
- Fixed the admissions dashboard's Firestore startup and collection mismatch; the local dashboard was observed loading application records.
- Added safeguards for removing content and uploaded images:
  - Content deletion checks whether its image is used by another managed item.
  - The media library refuses to remove an image that is still referenced.
  - Storage deletion is restricted to managed image paths and performed by a server-side Edge Function that checks the Firebase user's admin email.
- Added the `delete-school-image` Edge Function and set `verify_jwt = false` for it in `supabase/config.toml`. The function verifies the Firebase token itself.
- Added website content and media collection matches to `firestore-content.rules.example`.
- Local JavaScript syntax checks and `git diff --check` passed for the deletion changes.
- Deployed `delete-school-image` to Supabase project `xgxexobvstjgmnlzjrzc`.
- Smoke-tested the deployed endpoint from the local website origin without credentials; it returned the expected `401` sign-in-required response and an allowed CORS origin. No image was deleted during this test.
- Fixed the homepage news calls-to-action so "View all news" and story links lead to the News page rather than `#` or the current page.
- Added private application uploads for passport photos, report/results slips, and birth certificate/ID images or PDFs. The application record keeps storage paths rather than large base64 files.
- Added temporary applicant summary links, admin-only signed file links for the applicant detail and print forms, file type/size checks, and Firebase-admin authorization for private file access.
- Deployed the `admission-files` Edge Function. An unauthenticated smoke test returned the expected `403` response for the admin-only file-link operation.
- Fixed the admissions file upload validator to accept Firestore auto-generated alphanumeric document IDs (not just hexadecimal IDs) and redeployed `admission-files`.
- Verified the corrected endpoint accepts an OLS-style mixed-letter-and-number reference without uploading any files.
- Diagnosed the later passport upload failure: Supabase returns `Bucket not found` for `school-applications`; the private bucket has not yet been created.
- Updated and redeployed `admission-files` to return a clear setup instruction for the missing bucket. Verified the new `503` response using a tiny synthetic test file; no storage object was created.
- Identified that the applicant bucket shown by the user exists in a different Supabase project (`klwidoqeuifrwodmgjze`) than the project configured by the website and deployed function (`xgxexobvstjgmnlzjrzc`). User chose to keep applicant files in the website's configured project, so `school-applications` must also exist in `xgxexobvstjgmnlzjrzc`.
- Added admin-only cleanup of applicant files to single and bulk application deletion. The dashboard deletes associated private Supabase objects before deleting Firestore application records, and preserves the records if file cleanup fails. The cleanup endpoint validates managed paths, removes idempotently, and is bounded to 60 files per request.
- Verified the homepage news-link fallback resolves both `#` and same-page article links to `news.html`, while retaining a real external article URL.
- Verified the application, success, admin, and news pages return HTTP 200 locally. JavaScript syntax and whitespace checks pass.
- Added a rich-text editor for news, events, and gallery captions, including font choices, text size, emphasis, headings, lists, alignment, links, text colour, and highlighting.
- Rich formatting is saved alongside a plain-text fallback and sanitized before public rendering; existing plain-text content remains editable.
- Opened the local content editor in a browser and verified the formatting controls load. Tested the sanitizer against scripts and `javascript:` links; unsafe content was removed while safe font, colour, size, heading, and list formatting was retained.
- Fixed the content editor's saved-image picker to read from the namespaced website media collection.

### Current point

**The `delete-school-image` and `admission-files` Edge Functions are deployed.** Their unauthenticated access checks have been verified. The homepage news links now have a working News-page destination. The user chose to keep admissions storage in `xgxexobvstjgmnlzjrzc`, where the website functions are deployed. The bucket currently shown in the Supabase dashboard is in a different project; create the same private bucket in `xgxexobvstjgmnlzjrzc` before testing applicant file uploads, summary links, or admin file viewing. The endpoint now reports a missing bucket clearly. The website changes are local and still need deployment to Netlify. The complete signed-in deletion flow has not yet been tested with a real unused image. It is also not confirmed here whether the latest Firestore rules have been published.

No Git commit, push, or Netlify deployment has been made for these changes.

## Next steps

1. In Supabase Storage, create a bucket named `school-applications` and leave **Public bucket** switched off. Set the maximum file size to 5 MB and, if allowed MIME types are configured, permit `image/jpeg`, `image/png`, `image/webp`, and `application/pdf`.
2. Confirm the Supabase Edge Function secrets are present without exposing their values:
   - `FIREBASE_WEB_API_KEY`
   - `ADMIN_EMAILS` (including the authorized admin email)
   - `ALLOWED_ORIGINS` (the exact local and deployed website origins, comma-separated, with no trailing slashes)
   - The function also reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; Supabase supplies its project values to Edge Functions. Do not try to create or expose `SUPABASE_`-prefixed platform variables as custom secrets.
3. In the local application form, submit a test with a passport photo and test document files; verify the summary can display/open them.
4. In the local admin dashboard, open the test application and verify its photo and documents, then generate its printable form.
5. In the local admin media library, sign in and test deletion using a known unused website image.
6. Verify that an image still referenced by published content is retained and that the admin receives a clear message.
7. Delete a test content item with a unique image and verify both the Firestore record and its Storage object are removed.
8. Confirm the Firestore rules in the Firebase Console include the website content rules and the `olistar_website_media` rule.
9. After local testing, publish the intended website changes through Git/Netlify and repeat tests on the deployed site.

## Deployment and safety notes

- Supabase project: `xgxexobvstjgmnlzjrzc`
- Storage bucket: `school-media`
- The Storage bucket is public for viewing; uploads and deletions are performed server-side.
- Applicant images and documents use a separate private `school-applications` bucket. The setup will fail until this bucket is created with public access disabled.
- Applicant-file preview links expire after 15 minutes; admins can generate fresh links by reopening the application.
- Never put the Supabase service-role key in browser code, Git, or chat. Only set it as a Supabase Edge Function secret if required.
- Keep `verify_jwt = false` for this function because the handler validates Firebase ID tokens itself.
- If Storage deletion fails after a content record was deleted, the content stays deleted and the admin is warned; retry image cleanup from the media library after resolving the function error.
