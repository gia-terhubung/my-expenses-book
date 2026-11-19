import { SITE } from "@/config/site";
import type { LegalDoc } from "./legal-types";

/**
 * Privacy policy. The app facts (sections "on-device" to "deleting") restate
 * `docs/store/privacy-answers.md` and must stay true to it. Re-check this file
 * whenever the app gains a dependency or a network call.
 */
export const privacy: LegalDoc = {
  title: "Privacy policy",
  summary: "My Expenses Book keeps your receipts on your device. We built it so that we never see your data.",
  effectiveDate: "2026-11-19",
  intro: [
    {
      type: "p",
      text: `This policy covers the My Expenses Book app and this website, ${SITE.url.replace("https://", "")}, both provided by ${SITE.legalEntity}, ${SITE.country} ("we"). In short: your receipts stay on your device, and we never see them.`,
    },
  ],
  sections: [
    {
      id: "on-device",
      heading: "What stays on your device",
      blocks: [
        {
          type: "ul",
          items: [
            "Receipt photos, the text read from them, and every amount, date, note, category and folder are stored only on your device.",
            "The database and the images are encrypted. You can also lock the app with Face ID, fingerprint or your device passcode.",
            "There is no account, no ads, no analytics and no crash reporting in the app itself. The app is not directed at children.",
          ],
        },
      ],
    },
    {
      id: "network",
      heading: "What the app sends",
      blocks: [
        {
          type: "ol",
          items: [
            "**Exchange rates.** The app downloads public exchange-rate tables from `cdn.jsdelivr.net`. The request contains only a currency code and a date.",
            "**Tips.** When you open the Tip jar, the app asks the App Store or Google Play for prices. Apple or Google handles any payment. The app stores no payment information.",
            "**Android only: Google ML Kit.** On Android, receipt reading runs on your phone with Google ML Kit. ML Kit may download models from Google and send Google diagnostic data: device model, OS version, app version, a per-installation identifier and performance metrics. It never sends your receipt images or text. See Google's [ML Kit data disclosure](https://developers.google.com/ml-kit/android-data-disclosure). On iPhone, receipt reading uses Apple's on-device Vision framework and sends nothing.",
          ],
        },
      ],
    },
    {
      id: "backups",
      heading: "Backups and exports",
      blocks: [
        {
          type: "p",
          text: "Backups, CSV files and PDF reports are files you create and save where you choose. We never receive them. A backup with a passphrase is encrypted; one without is not.",
        },
      ],
    },
    {
      id: "deleting",
      heading: "Deleting your data",
      blocks: [
        {
          type: "p",
          text: "Deleting the app deletes all of its data from your device. Backup files you saved elsewhere stay until you delete them.",
        },
      ],
    },
    {
      id: "website",
      heading: "This website",
      blocks: [
        {
          type: "p",
          text: "This website sets no cookies and uses no analytics, advertising or tracking scripts. It is hosted by Vercel Inc. Vercel processes standard request logs (IP address, time, page, browser type) to deliver the pages and keep them secure. If you email us, we use your address and message only to reply.",
        },
      ],
    },
    {
      id: "changes",
      heading: "Your rights, changes and contact",
      blocks: [
        {
          type: "p",
          text: `Under Indonesia's Personal Data Protection Law (UU PDP), you can ask what personal data we hold about you and ask us to correct or delete it. Apart from emails you send us, we hold none. If this policy changes, the new version will be posted here with a new date. Contact: ${SITE.legalEntity}, [${SITE.contactEmail}](mailto:${SITE.contactEmail}).`,
        },
      ],
    },
  ],
};
