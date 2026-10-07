-- ==============================================================================
-- MIGRACIÓN: Agregar estado 'PROGRAMADO' al ENUM de eventos
-- Fix: I8 / P08 — La landing page de eventos públicos siempre devolvía vacío
-- Fecha: 2026-10-02
-- ==============================================================================

USE junta_las_jones;

ALTER TABLE eventos
  MODIFY COLUMN estado ENUM('BORRADOR', 'PROGRAMADO', 'CONVOCADO', 'REALIZADO', 'CANCELADO') NOT NULL DEFAULT 'BORRADOR';
