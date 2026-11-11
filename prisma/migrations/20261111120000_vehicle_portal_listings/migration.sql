CREATE TABLE "vehicle_portal_listings" (
    "vehicle_id" TEXT NOT NULL,
    "channel" "AdChannel" NOT NULL,
    "url" TEXT NOT NULL,
    "published_on" DATE NOT NULL,
    "withdrawn_at" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "vehicle_portal_listings_pkey" PRIMARY KEY ("vehicle_id", "channel"),
    CONSTRAINT "vehicle_portal_listings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id")
        REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Acceso únicamente desde el backend autorizado del CRM.
ALTER TABLE "vehicle_portal_listings" ENABLE ROW LEVEL SECURITY;
