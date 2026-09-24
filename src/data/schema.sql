-- Reforma Dental CRM — MySQL schema
-- Generado a partir del esquema actual de src/data/db.json (lowdb).
-- Este archivo se mantiene y actualiza manualmente (no hay migraciones automaticas).
-- Convencion: cada cambio de schema se agrega al final con un comentario "-- CHANGE: <fecha> <descripcion>".

CREATE DATABASE IF NOT EXISTS reforma_dental_crm
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE reforma_dental_crm;

-- Etapas del pipeline (New, Contacted, Scheduled, etc.)
CREATE TABLE stages (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  `order` INT NOT NULL DEFAULT 0,
  color VARCHAR(20) NOT NULL DEFAULT '#545758'
) ENGINE=InnoDB;

-- Leads (contactos captados via Facebook Lead Ads u otra fuente)
CREATE TABLE leads (
  id VARCHAR(64) PRIMARY KEY,
  fb_leadgen_id VARCHAR(64) NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'facebook',
  campaign_name VARCHAR(255) NULL,
  ad_name VARCHAR(255) NULL,
  form_name VARCHAR(255) NULL,
  field_data_raw JSON NULL,           -- respuestas crudas del formulario de Facebook
  stage VARCHAR(64) NOT NULL DEFAULT 'new',
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_leads_stage FOREIGN KEY (stage) REFERENCES stages(id),
  UNIQUE KEY uq_leads_fb_leadgen_id (fb_leadgen_id),
  INDEX idx_leads_stage (stage),
  INDEX idx_leads_created_at (created_at)
) ENGINE=InnoDB;

-- Actividades/log por lead (system, note, stage_change, capi_sent, capi_failed, ...)
CREATE TABLE activities (
  id VARCHAR(64) PRIMARY KEY,
  lead_id VARCHAR(64) NOT NULL,
  type VARCHAR(50) NOT NULL,          -- system | note | stage_change | capi_sent | capi_failed | message_sent | ...
  content TEXT NULL,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_activities_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  INDEX idx_activities_lead_id (lead_id),
  INDEX idx_activities_type (type)
) ENGINE=InnoDB;

-- Tareas asociadas a un lead (creadas manualmente o por reglas de automatizacion)
CREATE TABLE tasks (
  id VARCHAR(64) PRIMARY KEY,
  lead_id VARCHAR(64) NOT NULL,
  description VARCHAR(500) NOT NULL,
  due_at DATETIME(3) NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_tasks_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  INDEX idx_tasks_lead_id (lead_id),
  INDEX idx_tasks_due_at (due_at),
  INDEX idx_tasks_done (done)
) ENGINE=InnoDB;

-- Reglas de automatizacion (trigger -> action, con config variable segun accion)
CREATE TABLE automation_rules (
  id VARCHAR(64) PRIMARY KEY,
  `key` VARCHAR(100) NOT NULL UNIQUE,
  label VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,   -- new_lead | stage_change | stale_contacted | ...
  action VARCHAR(50) NOT NULL,         -- create_task | send_message
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  config JSON NOT NULL                 -- estructura libre segun action (delayHours, taskDescription, channel, templateKey, stage, staleHours...)
) ENGINE=InnoDB;

-- Plantillas de mensajes por canal (email | sms | whatsapp), agrupadas por key logica
CREATE TABLE templates (
  `key` VARCHAR(100) NOT NULL,
  channel VARCHAR(20) NOT NULL,        -- email | sms | whatsapp
  label VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NULL,           -- solo aplica a email
  body TEXT NOT NULL,
  PRIMARY KEY (`key`, channel)
) ENGINE=InnoDB;

-- Estado global de sincronizacion (singleton, siempre 1 fila con id=1)
CREATE TABLE sync_state (
  id TINYINT PRIMARY KEY DEFAULT 1,
  last_sync_at DATETIME(3) NULL,
  last_error TEXT NULL,
  last_capi_at DATETIME(3) NULL,
  last_capi_error TEXT NULL,
  token_valid BOOLEAN NULL,
  token_checked_at DATETIME(3) NULL,
  token_check_error TEXT NULL,
  CONSTRAINT chk_sync_state_singleton CHECK (id = 1)
) ENGINE=InnoDB;

INSERT INTO sync_state (id) VALUES (1);

-- CHANGE LOG
-- 2026-09-24: Version inicial, generada desde src/data/db.json (18 leads, 52 activities, 21 tasks, 5 automation_rules, 6 templates).
