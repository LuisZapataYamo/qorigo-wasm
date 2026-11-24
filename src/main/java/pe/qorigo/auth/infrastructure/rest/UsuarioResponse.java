package pe.qorigo.auth.infrastructure.rest;

public record UsuarioResponse(
        Long idUsuario,
        Long idPersona,
        String email,
        String rol,
        String nombres,
        String apellidos
) {
}
