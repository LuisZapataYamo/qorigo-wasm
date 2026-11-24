package pe.qorigo.auth.domain;

import java.time.Instant;

public record Usuario(
        Long idUsuario,
        Long idPersona,
        String emailLogin,
        String passwordHash,
        Rol rol,
        boolean activo,
        Instant creadoEn
) {
    public boolean puedeIniciarSesion() {
        return activo;
    }

    public Usuario conPasswordHash(String nuevoHash) {
        return new Usuario(idUsuario, idPersona, emailLogin, nuevoHash, rol, activo, creadoEn);
    }
}
