"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import NextLink from "next/link";
import { useMemo } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DentistRow } from "@/server/queries/admin-dentists";

import { DentistActions } from "./dentist-actions";

// Filtering and search happen on the server (URL params); the table only renders. Below `md` the same
// row model renders as cards, so nothing scrolls sideways on a phone.

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, DentistRow>();

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
const countryName = (code: string | null) => (code ? (countryNames.of(code) ?? code) : "–");

export function DentistsTable({ rows }: { rows: DentistRow[] }) {
  const t = useTranslations("admin.dentists");
  const format = useFormatter();
  const date = (iso: string | null) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: "medium" }) : "–";

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: t("columns.dentist"),
          cell: ({ row }) => (
            <NextLink href={`/admin/dentists/${row.original.id}`} className="group flex flex-col">
              <span className="font-medium text-ink group-hover:underline">
                {row.original.name}
              </span>
              <span className="text-xs text-ink-muted">{row.original.email}</span>
            </NextLink>
          ),
        }),
        helper.accessor("clinicName", {
          header: t("columns.clinic"),
          cell: ({ getValue }) => getValue() || "–",
        }),
        helper.accessor("country", {
          header: t("columns.country"),
          cell: ({ getValue }) => countryName(getValue()),
        }),
        helper.accessor("createdAt", {
          header: t("columns.registered"),
          cell: ({ getValue }) => date(getValue()),
        }),
        helper.accessor("reviewedAt", {
          header: t("columns.reviewed"),
          cell: ({ getValue }) => date(getValue()),
        }),
        helper.display({
          id: "actions",
          header: () => <span className="sr-only">{t("columns.actions")}</span>,
          cell: ({ row }) => (
            <div className="flex justify-end">
              <DentistActions dentist={row.original} size="sm" />
            </div>
          ),
        }),
      ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  const table = useTable({ features, columns, data: rows });
  const tableRows = table.getRowModel().rows;

  return (
    <>
      {/* Phones: cards */}
      <ul className="flex flex-col gap-3 md:hidden">
        {tableRows.map((row) => {
          const d = row.original;
          return (
            <li
              key={row.id}
              className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
            >
              <NextLink
                href={`/admin/dentists/${d.id}`}
                className="flex items-start justify-between gap-3"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-ink">{d.name}</span>
                  <span className="truncate text-sm text-ink-muted">{d.clinicName || "–"}</span>
                  <span className="truncate text-xs text-ink-muted">{d.email}</span>
                </span>
                <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-ink-muted" />
              </NextLink>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-xs text-ink-muted">
                <span>
                  {countryName(d.country)} · {t("columns.registered")} {date(d.createdAt)}
                </span>
                <DentistActions dentist={d} size="sm" />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Tablet and up: table */}
      <div className="hidden overflow-hidden rounded-card border border-line bg-surface md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-11 px-4 text-xs font-medium text-ink-muted"
                  >
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {tableRows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} className="px-4 py-3 text-sm">
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
