import { SITE } from "@/config/site";
import type { LegalDoc } from "./legal-types";

/**
 * Terms of use. DRAFT: written by the product team, not by a lawyer.
 * The owner should have it reviewed before the app is released.
 */
export const terms: LegalDoc = {
  title: "Terms of use",
  summary: "The rules for using My Expenses Book: a free app that keeps your receipts on your device, with an optional tip jar.",
  effectiveDate: "2026-11-17",
  intro: [
    {
      type: "p",
      text: `These terms are an agreement between you and ${SITE.legalEntity}, ${SITE.country} ("we"). They cover the My Expenses Book app ("the app") and this website. By installing or using the app, you agree to them. If you do not agree, do not use the app.`,
    },
  ],
  sections: [
    {
      id: "licence",
      heading: "1. Your licence",
      blocks: [
        {
          type: "p",
          text: "The app is free. We give you a personal, non-exclusive, non-transferable, revocable licence to install and use it on devices that you own or control, for your own personal or business record-keeping.",
        },
        { type: "p", text: "You may not:" },
        {
          type: "ul",
          items: [
            "sell, rent, sublicense or redistribute the app;",
            "copy, modify, reverse engineer or decompile it, except where the law gives you that right and it cannot be waived;",
            "remove or alter any notice of ownership;",
            "use the app in a way that breaks the law.",
          ],
        },
        {
          type: "p",
          text: "The app and its name, logo and design belong to us. Open-source components in the app stay under their own licences.",
        },
      ],
    },
    {
      id: "your-records",
      heading: "2. Your records are your responsibility",
      blocks: [
        {
          type: "ul",
          items: [
            "The app reads receipts automatically, and automatic reading makes mistakes. Check every value before you save it and before you rely on it.",
            "You are responsible for the accuracy and completeness of your records, and for how you use them in expense claims, accounts and tax returns.",
            "**The app does not give financial, accounting, tax or legal advice.** Ask a qualified adviser about your own situation.",
            "Keeping records in the app may not meet the record-keeping rules of your country or your employer. Keep the original receipts where you are required to.",
            "**Exchange rates are indicative.** They come from a free public data set, may be approximate or out of date, and may differ from the rate your bank or card issuer applied. You can enter your own rate.",
            "Totals, statistics and reports are calculated from the values you saved.",
          ],
        },
      ],
    },
    {
      id: "your-data",
      heading: "3. Your data and backups",
      blocks: [
        {
          type: "ul",
          items: [
            "Your receipts are stored only on your device. We do not have a copy, so we cannot restore them for you.",
            "Deleting the app, resetting your device, or losing or breaking it deletes your data. **Making backups, and keeping them safe, is your responsibility.**",
            "If you protect a backup with a passphrase and then forget it, nobody can recover that backup, including us.",
            "A backup saved without a passphrase is not encrypted. Anyone who can open the file can read it.",
            "Backups, CSV files and PDF reports are files you create. Where you store them and who you share them with is your choice and your responsibility.",
          ],
        },
        { type: "p", text: "Our [privacy policy](/privacy) explains what the app and this website do with data." },
      ],
    },
    {
      id: "tips",
      heading: "4. Tips",
      blocks: [
        {
          type: "ul",
          items: [
            "The app has a tip jar. **Tips are voluntary.** A tip is a way to say thank you. It is not a payment for a product, a feature, a subscription or support.",
            "**A tip unlocks nothing.** Every feature of the app works the same with or without one.",
            "Tips are in-app purchases sold through the Apple App Store or Google Play. Apple or Google takes the payment, and their terms apply to it. We do not receive or store your payment details.",
            "**Refunds are handled by Apple or Google under their own refund policies.** We cannot refund a tip ourselves. To ask for a refund, use [Apple's refund page](https://reportaproblem.apple.com) or [Google Play's refund help](https://support.google.com/googleplay/answer/2479637).",
            "Prices are shown in the app before you confirm, in your store's currency, and may include tax.",
          ],
        },
      ],
    },
    {
      id: "third-parties",
      heading: "5. Services from other companies",
      blocks: [
        {
          type: "p",
          text: "The app relies on services we do not control: the App Store and Google Play, a public exchange-rate data set, and, on Android, Google ML Kit. They may change, fail or stop. You must also follow any terms of other companies that apply to your use of the app, such as your mobile data plan and the store's terms.",
        },
      ],
    },
    {
      id: "apple",
      heading: "6. If you got the app from the Apple App Store",
      blocks: [
        { type: "p", text: "These extra terms apply to the iOS and iPadOS version of the app." },
        {
          type: "ul",
          items: [
            "**Who the agreement is with.** These terms are between you and us only, not Apple. We, not Apple, are solely responsible for the app and its content.",
            "**Scope of the licence.** Your licence is limited to using the app on Apple-branded products that you own or control, as permitted by the Usage Rules in the Apple Media Services Terms and Conditions. The app may also be used by other accounts linked to yours through Family Sharing or volume purchasing.",
            "**Maintenance and support.** We are solely responsible for any maintenance and support of the app. Apple has no obligation to provide maintenance or support for it.",
            "**Warranty.** We are solely responsible for any product warranty, to the extent that it is not effectively disclaimed. If the app fails to conform to an applicable warranty, you may notify Apple, and Apple will refund the purchase price of the app, if any. To the maximum extent permitted by law, Apple has no other warranty obligation for the app.",
            "**Product claims.** We, not Apple, are responsible for dealing with any claim by you or anyone else about the app or your possession or use of it. This includes product liability claims, claims that the app fails to meet a legal or regulatory requirement, and claims under consumer protection, privacy or similar laws.",
            "**Intellectual property.** If someone claims that the app, or your possession and use of it, infringes their intellectual property rights, we, not Apple, are solely responsible for investigating, defending, settling and discharging that claim.",
            "**Legal compliance.** You confirm that you are not located in a country that is subject to a United States Government embargo or that the United States Government has designated as a \"terrorist supporting\" country, and that you are not on any United States Government list of prohibited or restricted parties.",
            "**Third-party beneficiary.** Apple and its subsidiaries are third-party beneficiaries of these terms. When you accept these terms, Apple has the right, and is deemed to have accepted the right, to enforce them against you as a third-party beneficiary.",
          ],
        },
      ],
    },
    {
      id: "no-warranty",
      heading: "7. No warranty",
      blocks: [
        {
          type: "p",
          text: "The app and this website are provided \"as is\" and \"as available\". As far as the law allows, we give no warranty of any kind, express or implied. This includes warranties of merchantability, fitness for a particular purpose, accuracy and non-infringement. We do not promise that the app will read every receipt correctly, that it will work without errors or interruptions, or that it will stay available.",
        },
      ],
    },
    {
      id: "liability",
      heading: "8. Limits on our liability",
      blocks: [
        {
          type: "p",
          text: "As far as the law allows, we are not liable for any indirect, incidental, special or consequential loss, or for lost data, lost profits, tax penalties, rejected expense claims or other financial loss that results from using the app or being unable to use it.",
        },
        {
          type: "p",
          text: "As far as the law allows, our total liability to you for all claims about the app is limited to the larger of two amounts: the total of the tips you gave in the 12 months before the claim, or IDR 100,000.",
        },
        {
          type: "p",
          text: "Nothing in these terms removes or limits a right or a liability that the law does not allow to be removed or limited. This includes your rights as a consumer under the law that applies to you.",
        },
      ],
    },
    {
      id: "ending",
      heading: "9. Ending these terms",
      blocks: [
        {
          type: "p",
          text: "You can stop using the app at any time by deleting it. Your licence ends automatically if you break these terms. Sections 2, 3, 7, 8 and 11 continue to apply after the licence ends.",
        },
      ],
    },
    {
      id: "changes",
      heading: "10. Changes",
      blocks: [
        {
          type: "p",
          text: "We may update the app, and we may change or stop offering it. We may also change these terms. The new version will be posted on this page with a new effective date. If you keep using the app after that date, you accept the new terms.",
        },
      ],
    },
    {
      id: "law",
      heading: "11. Governing law",
      blocks: [
        {
          type: "p",
          text: "These terms are governed by the laws of the Republic of Indonesia. We will first try to settle any dispute with you by talking it through in good faith. If that fails, the dispute goes to the competent courts of the Republic of Indonesia. Consumer protection rules of the country where you live that cannot be waived still apply to you.",
        },
        {
          type: "p",
          text: "If a court finds part of these terms invalid, the rest stays in force.",
        },
      ],
    },
    {
      id: "contact",
      heading: "12. Contact",
      blocks: [
        {
          type: "p",
          text: `${SITE.legalEntity}, ${SITE.country}. Questions, complaints and claims about the app: [${SITE.contactEmail}](mailto:${SITE.contactEmail}).`,
        },
      ],
    },
  ],
};
