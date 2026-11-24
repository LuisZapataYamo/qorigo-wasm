INSERT INTO moneda (codigo, nombre, decimales) VALUES ('PEN', 'Sol peruano', 2);
INSERT INTO moneda (codigo, nombre, decimales) VALUES ('USD', 'Dólar estadounidense', 2);
INSERT INTO moneda (codigo, nombre, decimales) VALUES ('EUR', 'Euro', 2);

INSERT INTO plataforma (nombre, descripcion, activo) VALUES ('YouTube', 'Suscripción de YouTube', TRUE);
INSERT INTO plataforma (nombre, descripcion, activo) VALUES ('Microsoft', 'Suscripción de Microsoft', TRUE);
INSERT INTO plataforma (nombre, descripcion, activo) VALUES ('Obsidian', 'Suscripción de Obsidian', TRUE);

INSERT INTO configuracion (clave, valor) VALUES ('umbral_riesgo_dias', '30');
INSERT INTO configuracion (clave, valor) VALUES ('imagen_ancho', '100');
INSERT INTO configuracion (clave, valor) VALUES ('imagen_alto', '100');
INSERT INTO configuracion (clave, valor) VALUES ('metodos_con_comprobante', 'YAPE,PLIN,TRANSFERENCIA');
