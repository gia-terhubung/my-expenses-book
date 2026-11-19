import { COMPANY_ADDRESS, COMPANY_CITY, SITE } from "@/config/site";
import type { LegalDoc } from "./legal-types";

/**
 * Terms of use. Written by the product team, not by a lawyer, and kept short on
 * purpose: fewer clauses, less that can be unenforceable. Have it reviewed once
 * the app has users or income.
 */
export const terms: LegalDoc = {
  title: "Terms of use",
  summary: "The rules for using My Expenses Book: a free app that keeps your receipts on your device, with an optional tip jar.",
  effectiveDate: "2026-11-19",
  intro: [
    {
      type: "p",
      text: `These terms are an agreement between you and ${SITE.legalEntity}, ${SITE.country} ("we"). They cover the My Expenses Book app ("the app") and this website. By using the app, you agree to them. If you do not agree, do not use the app.`,
    },
  ],
  sections: [
    {
      id: "licence",
      heading: "1. Using the app",
      blocks: [
        {
          type: "p",
          text: "The app is free. You may use it on your own devices for your personal or business records. Do not sell, copy or redistribute it, and do not use it to break the law. The app, its name and its logo belong to us. Open-source parts keep their own licences.",
        },
      ],
    },
    {
      id: "your-records",
      heading: "2. Your records",
      blocks: [
        {
          type: "ul",
          items: [
            "The app reads receipts automatically and can make mistakes. Check every value before you rely on it. Your records are your responsibility.",
            "**The app does not give financial, accounting, tax or legal advice.**",
            "**Exchange rates are indicative.** They come from a free public data set and may differ from your bank's rate. You can enter your own rate.",
          ],
        },
      ],
    },
    {
      id: "your-data",
      heading: "3. Your data and backups",
      blocks: [
        {
          type: "p",
          text: "Your receipts are stored only on your device. We have no copy and cannot restore them. If you delete the app or lose your device, your data is gone. **Making backups, and keeping them safe, is your responsibility.** A forgotten backup passphrase cannot be recovered by anyone. See our [privacy policy](/privacy).",
        },
      ],
    },
    {
      id: "tips",
      heading: "4. Tips",
      blocks: [
        {
          type: "p",
          text: "**Tips are voluntary.** **A tip unlocks nothing**: the app works the same with or without one. Apple or Google takes the payment under their own terms. **Refunds are handled by Apple or Google under their own refund policies**: use [Apple's refund page](https://reportaproblem.apple.com) or [Google Play's refund help](https://support.google.com/googleplay/answer/2479637).",
        },
      ],
    },
    {
      id: "apple",
      heading: "5. If you got the app from the Apple App Store",
      blocks: [
        {
          type: "p",
          text: `Apple's Standard Licensed Application End User License Agreement also applies. These terms are between you and us only, not Apple. We, not Apple, are responsible for the app, its support and any claims about it. Apple has no warranty or support obligation for the app, except to refund its price (if any) under Apple's rules. Apple and its subsidiaries are third-party beneficiaries of these terms and may enforce them. Developer: ${SITE.legalEntity}, ${COMPANY_ADDRESS}, ${SITE.country}.`,
        },
      ],
    },
    {
      id: "liability",
      heading: "6. No warranty and limited liability",
      blocks: [
        {
          type: "p",
          text: "The app and this website are provided \"as is\". As far as the law allows, we give no warranty that they are accurate, error-free or always available. The app relies on services we do not control, such as the app stores and the exchange-rate data, and these may change or stop.",
        },
        {
          type: "p",
          text: "To the extent permitted by applicable law, our total liability to you for all claims about the app is limited to the larger of the tips you gave in the last 12 months or IDR 100,000. We are not liable for lost data, tax penalties, rejected expense claims or other indirect loss. Nothing here limits your rights as a consumer that the law does not allow to be limited.",
        },
      ],
    },
    {
      id: "changes",
      heading: "7. Changes",
      blocks: [
        {
          type: "p",
          text: "We may change or stop the app, and we may change these terms. The new terms will be posted here with a new date. You can stop using the app at any time by deleting it.",
        },
      ],
    },
    {
      id: "law",
      heading: "8. Governing law",
      blocks: [
        {
          type: "p",
          text: `These terms are governed by the laws of the Republic of Indonesia. We will first try to settle any dispute by talking with you. If that fails, the District Court (Pengadilan Negeri) of ${COMPANY_CITY} decides. If a court finds part of these terms invalid, the rest still applies.`,
        },
      ],
    },
    {
      id: "contact",
      heading: "9. Contact",
      blocks: [
        {
          type: "p",
          text: `${SITE.legalEntity}, ${COMPANY_ADDRESS}, ${SITE.country}. Email: [${SITE.contactEmail}](mailto:${SITE.contactEmail}).`,
        },
      ],
    },
  ],
};
