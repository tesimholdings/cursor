import { classifyDeal } from "@/lib/classification";
import { closeSpeedResult } from "@/lib/close-speed";
import type { Deal } from "@/lib/types";

export function DealScanPills({
  deal,
  className = "",
}: {
  deal: Deal;
  className?: string;
}) {
  const complete =
    deal.businessCategory &&
    deal.operatingStyleTags?.length &&
    deal.riskSnapshot &&
    deal.assetProfile &&
    deal.boxFit &&
    deal.earningsQuality &&
    deal.recordTag;
  const computed = complete ? null : classifyDeal(deal);
  const category = deal.businessCategory || computed!.businessCategory;
  const styles = deal.operatingStyleTags || computed!.operatingStyleTags;
  const risk = deal.riskSnapshot || computed!.riskSnapshot;
  const asset = deal.assetProfile || computed!.assetProfile;
  const box = deal.boxFit || computed!.boxFit;
  const earnings = deal.earningsQuality || computed!.earningsQuality;
  const record = deal.recordTag || computed!.recordTag;
  const close = closeSpeedResult(deal);

  return (
    <div className={`flex flex-wrap gap-1.5 text-[11px] font-semibold ${className}`}>
      <Pill text={category} style="bg-slate-100 text-slate-800" />
      {styles.map((style) => (
        <Pill
          key={style}
          text={style}
          style={
            style === "Hands-off"
              ? "bg-sky-100 text-sky-900"
              : style === "Mixed"
                ? "bg-violet-100 text-violet-900"
                : "bg-blue-100 text-blue-900"
          }
        />
      ))}
      <Pill
        text={risk}
        style={
          risk === "Safer"
            ? "bg-emerald-100 text-emerald-900"
            : risk === "Riskier"
              ? "bg-red-100 text-red-900"
              : risk === "Mixed"
                ? "bg-amber-100 text-amber-950"
                : "bg-stone-100 text-stone-700"
        }
      />
      <Pill
        text={asset}
        style={
          asset === "Asset-heavy"
            ? "bg-indigo-100 text-indigo-900"
            : asset === "Asset-light"
              ? "bg-orange-100 text-orange-900"
              : "bg-stone-100 text-stone-700"
        }
      />
      <Pill
        text={box}
        style={
          box === "In-box"
            ? "bg-emerald-100 text-emerald-900"
            : box === "Stretch"
              ? "bg-amber-100 text-amber-950"
              : box === "Too small" || box === "Too big"
                ? "bg-red-100 text-red-900"
                : "bg-stone-100 text-stone-700"
        }
      />
      <Pill
        text={earnings}
        style={
          earnings === "Tax-tied"
            ? "bg-emerald-100 text-emerald-900"
            : earnings === "Recast"
              ? "bg-amber-100 text-amber-950"
              : "bg-stone-100 text-stone-700"
        }
      />
      {record === "Seed / Demo" && (
        <Pill text={record} style="bg-purple-100 text-purple-900" />
      )}
      <Pill
        text={`${close.speed} close`}
        title={close.reasons.join(" ")}
        style={
          close.speed === "Fast"
            ? "bg-teal-100 text-teal-950"
            : close.speed === "Slow"
              ? "bg-rose-100 text-rose-950"
              : "bg-slate-100 text-slate-800"
        }
      />
    </div>
  );
}

function Pill({
  text,
  style,
  title,
}: {
  text: string;
  style: string;
  title?: string;
}) {
  return (
    <span className={`rounded-full px-2 py-0.5 leading-5 ${style}`} title={title}>
      {text}
    </span>
  );
}
