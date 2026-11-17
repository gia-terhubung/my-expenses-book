import type { Metadata } from "next";
import Link from "next/link";
import { PageSlip } from "@/components/PageSlip";
import { notFound } from "@/content/landing";
import styles from "./not-found.module.css";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <PageSlip title={notFound.title} lead={notFound.lead}>
      <p className={styles.link}>
        <Link href="/">{notFound.linkLabel}</Link>
      </p>
    </PageSlip>
  );
}
