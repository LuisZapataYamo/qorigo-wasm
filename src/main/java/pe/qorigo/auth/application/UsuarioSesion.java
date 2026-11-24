package pe.qorigo.auth.application;

import pe.qorigo.auth.domain.Rol;

public record UsuarioSesion(
        Long idUsuario,
        Long idPersona,
        String email,
        Rol rol,
        String nombres,
        String apellidos
) {
}
