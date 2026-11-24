package pe.qorigo.auth.infrastructure.rest;

import java.time.Instant;

public record LoginResponse(String token, Instant expiraEn, UsuarioResponse usuario) {
}
