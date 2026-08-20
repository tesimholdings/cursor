import { NextResponse } from "next/server";

export async function GET() {
  const csv = `Company Name,Listing URL,Industry,Location,Asking Price,Revenue,EBITDA,SDE / Cash Flow,Employees,Real Estate Included,FF&E,Seller Financing,Notes,Broker,Source
Midwest Plastics Works,,Injection molding,Akron OH,6200000,3800000,720000,910000,24,Yes,1400000,Yes,Custom molder for industrial accounts,Summit Brokers,BizBuySell
Harbor Die Cast,,Aluminum die casting,Muskegon MI,8800000,6100000,1100000,1250000,40,Yes,2200000,No,Die caster with automotive exposure,Capital Advisors,Direct
Blue Ridge Sheet Metal,,HVAC sheet metal fab,Roanoke VA,4100000,2900000,,640000,18,No,480000,Yes,Shop fabricating duct and specialty metal,Main Street Biz,Axial
Cedar Creek Cabinets,,Custom cabinetry,Asheville NC,3500000,2200000,,390000,14,No,210000,No,Residential kitchens owner-led design,Local Broker,LoopNet listing
`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=sample-acquisition-list.csv",
    },
  });
}
