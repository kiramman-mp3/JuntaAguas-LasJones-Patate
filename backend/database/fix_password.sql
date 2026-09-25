USE junta_las_jones;
UPDATE cuentas SET password_hash = '$2a$10$sM2vxq/BRiJnSfp5V8aeaeWHyU8UNrCN4biRh4kcmLiFwgq9J2/Qa', debe_cambiar_password = FALSE WHERE id = 1;
