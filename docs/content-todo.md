# Content to collect from Dr. Hossam

Everything below is a **placeholder** on the website today. Nothing was invented: no stats,
prices, names or reviews. Send this list to the doctor, then replace each item where noted.

## Numbers (home page)

Edit as the `stats` **SiteSetting** (JSON). A missing or `null` field shows `[X]`.

| Field                   | Shown as                                       | Where                 |
| ----------------------- | ---------------------------------------------- | --------------------- |
| `stats.clinics`         | "Trusted by **[X]** dental clinics in Denmark" | Hero, trust line      |
| `stats.yearsExperience` | "**[X]** years of experience"                  | Hero, Dr. Hossam card |
| `stats.guidesDelivered` | "Guides delivered: **[X]**" (count-up)         | Technology, stat card |
| `stats.turnaroundDays`  | "Typical turnaround: **[X]** working days"     | Technology, stat card |

Example value: `{ "clinics": 40, "yearsExperience": 12, "guidesDelivered": 900, "turnaroundDays": 5 }`

> "Implant systems in our catalog" is **not** a placeholder. It counts the active rows in the
> ImplantSystem catalog, which currently holds the seeded **EXAMPLE** data (8 systems).

## Contact (footer)

Edit the `contact` **SiteSetting**: `email` is already set (info.dentnord@gmail.com).

- [ ] `phone`: currently shows `[phone]`
- [ ] `address` (`{ "da": "...", "en": "..." }`): currently shows `[address]`
- [ ] `cvr` (CVR number): currently shows `CVR [CVR]`

## About Dr. Hossam (`messages/*.json` → `home.about`)

- [ ] Credentials / title for the portrait badge: `Dr. Hossam · [credentials]`
- [ ] Short bio (2–3 sentences): `[Short bio of Dr. Hossam — pending]`
- [ ] Years of experience: `[X] years`
- [ ] City: `[City], Denmark`
- [ ] Languages: `[Languages]`
- [ ] Confirm the four expertise rows and their tags (Single implants · Tooth-supported,
      Full-arch · Stackable guides, Bone-supported guides · Bone-anchored, Planning only · Plan + report)

## Testimonials (`home.testimonials`, 3 slots)

- [ ] 3 quotes from dentists **with written consent**, plus name and clinic for each.
      Currently `[Testimonial N from a dentist — pending]` / `[Name, clinic — pending]`.

## Prices

- [ ] Real price list. The portal-preview "Estimate" card shows `[price]` for every line.
- [ ] The Service and GuideType catalogs hold **EXAMPLE** prices from the seed. Replace them in
      the admin dashboard (the services carousel doesn't show prices yet).

## Photos (`PlaceholderImage` → `next/image`, one-line swap each)

| Placeholder label                         | Component                                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| Hero photo: Dr. Hossam at work            | `components/marketing/home/hero.tsx`                                                         |
| Photo: Dr. Hossam (small, hero card)      | `components/marketing/home/hero.tsx`                                                         |
| Photo: {service title} (one per service)  | `components/marketing/home/services-carousel.tsx` (move to a `Service.image` field)          |
| Portrait: Dr. Hossam                      | `components/marketing/home/about.tsx`                                                        |
| Photo: the 3D printer in the Dentnord lab | `components/marketing/home/technology.tsx`                                                   |
| Avatars in the hero trust line (3)        | `components/marketing/home/hero.tsx` (gradient circles; replace with clinic logos or remove) |

## 3D model

- [ ] The doctor's surgical guide STL → `public/models/guide.glb`. See `public/models/README.md`
      for the conversion command. Until then the site shows a procedural placeholder guide.

## Copy review

- [ ] **Danish copy** (`messages/da.json`, flagged `"_review": true`): needs review by a native speaker.
- [ ] Claims to confirm with the doctor: "printed in-house / in our own lab", "planned and
      printed in Denmark", "sleeves matched to your implant system and kit", and the 4-step workflow.
- [ ] Portfolio, Services, About and Contact pages: content still to come.
