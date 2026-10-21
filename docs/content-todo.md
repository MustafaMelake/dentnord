# Content to collect from Dr. Hossam

**The source of truth is now the admin dashboard:** `/admin/dashboard` → **Content checklist**. It lists
every piece of public content that is still missing, links straight to the field, and shows a
completion percentage. Everything is edited in the admin (Services, Catalog, Portfolio, Settings);
nothing needs a deploy.

On the public site, anything not filled in is **hidden** from visitors. Logged-in admins see a small
dashed "Missing: …" marker in its place (on the same public pages), linking to the admin field.

What still lives outside the admin:

## Copy in `messages/*.json` (needs a code change)

- [ ] **Danish copy** (`messages/da.json`, flagged `"_review": true`): review by a native speaker.
- [ ] Claims to confirm with the doctor: "printed in-house / in our own lab", "planned and printed in
      Denmark", "sleeves matched to your implant system and kit", the 4-step workflow, and the doctor's
      role line on the hero card ("Dentist · implant planning").
- [ ] Services, About and Contact pages: content still to come (they show "under construction").

## 3D model

- [ ] The doctor's surgical guide STL → `public/models/guide.glb`. See `public/models/README.md` for
      the conversion command. Until then the site shows a procedural placeholder guide.

## Notes

- The catalog (services, guide types, implant systems, kits) starts with **example** rows from the
  seed. The admin flags them ("Example") and the checklist counts them until they are edited or
  archived. Example prices are not shown on the public site.
- Testimonials can only be published with the dentist's written consent (enforced in the form, the
  server and the database).
