import { NextResponse } from "next/server";
import { getAllIncidents } from "@/lib/db-seed";
import { getServerGatewayStatus } from "@/lib/otari-gateway";

export async function GET() {
  try {
    const incidents = await getAllIncidents();
    return NextResponse.json({
      incidents,
      gatewayStatus: getServerGatewayStatus(),
    });
  } catch (error) {
    console.error("Failed to fetch incidents:", error);
    return NextResponse.json(
      { error: "Failed to fetch saved incidents" },
      { status: 500 }
    );
  }
}
