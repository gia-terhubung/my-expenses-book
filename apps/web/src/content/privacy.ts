import { SITE } from "@/config/site";
import type { LegalDoc } from "./legal-types";

/**
 * Privacy policy. The app facts (sections "on-device" to "children") restate
 * `docs/store/privacy-answers.md` and must stay true to it. Re-check this file
 * whenever the app gains a dependency or a network call.
 */
export const privacy: LegalDoc = {
  title: "Privacy policy",
  summary: "My Expenses Book keeps your receipts on your device. We built it so that we never see your data.",
  effectiveDate: "2026-11-17",
  intro: [
    {
      type: "p",
      text: `This policy covers the My Expenses Book app and this website, ${SITE.url.replace("https://", "")}. Both are provided by ${SITE.legalEntity}, ${SITE.country} ("we").`,
    },
    {
      type: "p",
      text: "My Expenses Book keeps your receipts on your device. We built it so that we never see your data.",
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
            "There is no account. There are no ads, no analytics and no crash reporting in the app itself (see Google ML Kit below for Android).",
          ],
        },
      ],
    },
    {
      id: "network",
      heading: "Network connections the app makes",
      blocks: [
        {
          type: "ol",
          items: [
            "**Exchange rates.** To convert foreign receipts into your home currency, the app downloads public exchange-rate tables from `cdn.jsdelivr.net` (the open `@fawazahmed0/currency-api` data set). The request contains only a currency code and a date. It contains no receipt data.",
            "**Tips.** When you open the Tip jar, the app asks the App Store or Google Play for prices and processes a tip you choose to give. Apple or Google handles the payment. The app stores no payment information.",
            "**Android only: Google ML Kit.** On Android, text recognition, document scanning and on-device AI run on your phone using Google ML Kit. ML Kit may download its models from Google and sends Google diagnostic data: device model and OS version, the app's package name and version, a per-installation identifier, and performance metrics such as latency and error codes. It never sends your receipt images or text. Google says it does not share this data with third parties and encrypts it in transit. On iPhone, text recognition uses Apple's on-device Vision framework and sends nothing.",
          ],
        },
        {
          type: "p",
          text: "Google describes the ML Kit data in its [ML Kit data disclosure](https://developers.google.com/ml-kit/android-data-disclosure).",
        },
      ],
    },
    {
      id: "backups",
      heading: "Backups and exports",
      blocks: [
        {
          type: "p",
          text: "Backups, CSV files and PDF reports are files that you create and save wherever you choose. A backup protected with a passphrase is encrypted. A backup without one is not. We never receive these files. If you forget a backup passphrase, nobody can recover that backup.",
        },
      ],
    },
    {
      id: "deleting",
      heading: "Deleting your data",
      blocks: [
        {
          type: "p",
          text: "Deleting the app deletes all of its data from your device. Backup files you saved elsewhere stay where you put them until you delete them.",
        },
      ],
    },
    {
      id: "children",
      heading: "Children",
      blocks: [
        {
          type: "p",
          text: "The app is not directed at children and collects no personal information from anyone.",
        },
      ],
    },
    {
      id: "website",
      heading: "This website",
      blocks: [
        {
          type: "ul",
          items: [
            "This website sets no cookies and uses no analytics, advertising or tracking scripts.",
            "It loads nothing from other companies' servers. The fonts and images are served from this site.",
            "The site is hosted by Vercel Inc. Like any web host, Vercel processes standard request logs to deliver the pages and keep the service secure: your IP address, the time, the page requested and your browser type. We do not use these logs to identify you or to build a profile of you.",
            "The site has no forms and no sign-up. If you email us, we use your address and your message only to reply to you.",
          ],
        },
      ],
    },
    {
      id: "changes",
      heading: "Changes and contact",
      blocks: [
        {
          type: "p",
          text: `If this policy changes, the new version will be posted on this page with a new effective date. Questions: [${SITE.contactEmail}](mailto:${SITE.contactEmail}).`,
        },
      ],
    },
  ],
};
