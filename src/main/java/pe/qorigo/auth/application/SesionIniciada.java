package pe.qorigo.auth.application;

import java.time.Instant;

public record SesionIniciada(String token, Instant expiraEn, UsuarioSesion usuario) {
}
