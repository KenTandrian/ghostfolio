resource "google_apphub_application" "ghostfolio" {
  application_id = lower(var.app_name)
  description    = "${var.app_name} application"
  display_name   = var.app_name
  location       = var.region

  attributes {
    criticality { type = "MISSION_CRITICAL" }
    environment { type = "PRODUCTION" }
  }

  scope {
    type = "REGIONAL"
  }
}

data "google_cloud_run_service" "ghostfolio" {
  name     = lower(var.app_name)
  location = var.region
}

data "google_apphub_discovered_service" "ghostfolio" {
  location    = var.region
  service_uri = "//run.googleapis.com/projects/${var.project_id}/locations/${var.region}/services/${data.google_cloud_run_service.ghostfolio.name}"
}

resource "google_apphub_service" "ghostfolio" {
  application_id     = google_apphub_application.ghostfolio.application_id
  discovered_service = data.google_apphub_discovered_service.ghostfolio.name
  display_name       = "Cloud Run - ${var.app_name}"
  location           = var.region
  service_id         = "gcr-${lower(var.app_name)}"

  attributes {
    criticality { type = "MISSION_CRITICAL" }
    environment { type = "PRODUCTION" }
  }
}
