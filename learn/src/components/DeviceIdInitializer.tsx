"use client";
import { useEffect } from "react";
import { getDeviceId } from "@/lib/device-id";

export function DeviceIdInitializer() {
  useEffect(() => {
    getDeviceId();
  }, []);
  return null;
}
