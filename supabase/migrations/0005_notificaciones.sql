-- Sistema de notificaciones: se derivan de eventos (no hay tabla "tareas" en
-- este proyecto; eventos ya cumple ese rol: seguimientos con fecha_hora y
-- responsable). leida_en distingue "vista" de "completada": son acciones
-- independientes.
alter table eventos add column if not exists leida_en timestamptz;
comment on column eventos.leida_en is 'Momento en que el responsable vio esta notificación en la campana. No implica que el evento esté completado.';

alter table usuarios add column if not exists notificaciones_activas boolean not null default true;
comment on column usuarios.notificaciones_activas is 'Si es false, la campana de notificaciones no muestra avisos a este usuario (los eventos se siguen generando igual).';
