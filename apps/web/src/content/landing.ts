import type { ShotId } from "./screenshots";

/** All landing page copy. Components render it; they contain no prose of their own. */

export const hero = {
  title: "Scan a receipt. Keep the record, not the paper.",
  lead: "My Expenses Book reads the merchant, date, total, tax and currency from a receipt, and you only confirm. Everything is stored on your phone, encrypted. No account, no ads, no tracking.",
  note: "Free. For iPhone, iPad and Android phones, tablets and foldables. Requires iOS 16.4 or Android 8, or later.",
  shot: "home-slip" as ShotId,
};

export const storeBadges = {
  /** Shown instead of badges while a store has no listing. Official badges are never greyed out. */
  comingSoonBoth: "Coming soon to the App Store and Google Play.",
  comingSoonAppStore: "Coming soon to the App Store.",
  comingSoonGooglePlay: "Coming soon to Google Play.",
  /** Alt text of the official badges. */
  appStoreAlt: "Download on the App Store",
  googlePlayAlt: "Get it on Google Play",
};

export const howItWorks = {
  id: "how-it-works",
  title: "Three steps from paper to record",
  steps: [
    {
      name: "Scan",
      body: "Scan a paper receipt with the camera, or import photos and screenshots. A receipt with several pages stays together as one record.",
      shot: "capture" as ShotId,
    },
    {
      name: "Review",
      body: "The app fills in the merchant, date, total, tax, currency and category. A field it is unsure about is marked “Check this”. Nothing is saved until you confirm.",
      shot: "review" as ShotId,
    },
    {
      name: "Book",
      body: "The receipt joins your book. It is grouped by month, added to the total in your home currency, and findable by merchant, note or any word printed on it.",
      shot: "receipt-detail" as ShotId,
    },
  ],
};

export const privacyPromise = {
  id: "privacy",
  title: "What leaves your phone",
  body: "Your receipts are stored only on your device, in an encrypted database with encrypted images. You can also lock the app with Face ID, fingerprint or your device passcode.",
  /** Printed as a till receipt: label on the left, figure on the right. */
  receipt: {
    heading: "Sent to us",
    rows: [
      { label: "Receipt photos", value: "0" },
      { label: "Amounts, dates and notes", value: "0" },
      { label: "Accounts to sign up for", value: "0" },
      { label: "Ads", value: "0" },
      { label: "Analytics and crash reports", value: "0" },
    ],
    totalLabel: "Total",
    totalValue: "0",
  },
  networkTitle: "The app goes online for three things",
  network: [
    {
      name: "Exchange rates.",
      body: "It downloads public exchange-rate tables. The request holds a currency code and a date, and nothing about you.",
    },
    {
      name: "Tips.",
      body: "If you open the tip jar, the App Store or Google Play shows the prices and handles the payment.",
    },
    {
      name: "Android only: Google ML Kit.",
      body: "It reads receipts on your phone and sends Google its own diagnostics. It never sends your receipt images or text.",
    },
  ],
  linkLabel: "Read the privacy policy",
  linkHref: "/privacy",
};

export const features = {
  id: "features",
  title: "What the book does",
  shot: "statistics" as ShotId,
  items: [
    {
      name: "Many currencies",
      body: "Each receipt keeps its own currency. A foreign receipt is converted to your home currency at the rate of the purchase date, and you can enter your own rate.",
    },
    {
      name: "Folders and tax years",
      body: "Put receipts in folders for trips and projects. Tax-year views add up each year.",
    },
    {
      name: "Search",
      body: "Search merchants, notes and the text of the receipt itself, then narrow the results with filters.",
    },
    {
      name: "Statistics",
      body: "Compare this month with the last one, and see the last six months, your categories and your top merchants.",
    },
    {
      name: "Export",
      body: "Export a CSV file or a PDF report for expense claims and tax returns.",
    },
    {
      name: "Backup",
      body: "Save one backup file, protected by a passphrase, wherever you like. Restore it later or merge it into the receipts already on the phone.",
    },
    {
      name: "App lock",
      body: "Open the app with Face ID, fingerprint or your device passcode.",
    },
    {
      name: "Languages",
      body: "The app is in English, Indonesian, Spanish and Brazilian Portuguese, and it reads receipts in many more languages.",
    },
  ],
};

export const audiences = {
  id: "who-it-is-for",
  title: "Who keeps a book like this",
  items: [
    {
      name: "Travellers and expense claimers",
      body: "Scan receipts in any currency as you go. Each one is converted at the rate of the day you paid. Put the trip in a folder and export a PDF report when you file the claim.",
    },
    {
      name: "Freelancers",
      body: "Keep business receipts through the year. The tax-year view gives you the totals and the CSV export gives your accountant the rows. The app keeps records; it does not give tax advice.",
    },
    {
      name: "Households",
      body: "See where the month went, by category and by merchant. When you need an old receipt for a warranty, search for the shop or the item.",
    },
  ],
};

export const tipJar = {
  id: "tip-jar",
  title: "Free, with a tip jar",
  body: "My Expenses Book is free, with no ads and no tracking. If it makes your receipts easier to deal with, you can buy the developer a coffee from the tip jar inside the app.",
  note: "Tips are optional and unlock nothing. Every feature works with or without one.",
  shot: "tip-jar" as ShotId,
};

export const notFound = {
  title: "This page is not in the book",
  lead: "The address may be mistyped, or the page has moved.",
  linkLabel: "Go to the home page",
};
