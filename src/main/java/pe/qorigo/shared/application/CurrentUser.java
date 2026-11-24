package pe.qorigo.shared.application;

/**
 * Identidad de la petición. Siempre proviene de la sesión (JWT), nunca de un
 * identificador enviado por el cliente.
 */
public interface CurrentUser {

    Long idUsuario();

    Long idPersona();

    String email();

    String rol();

    default boolean esAdmin() {
        return "ADMIN".equals(rol());
    }

    default boolean autenticado() {
        return idUsuario() != null;
    }

    default Long idPersonaRequerido() {
        Long id = idPersona();
        if (id == null) {
            throw new pe.qorigo.shared.domain.NoAutorizadoException("La sesión no tiene persona asociada");
        }
        return id;
    }

    default Long idUsuarioRequerido() {
        Long id = idUsuario();
        if (id == null) {
            throw new pe.qorigo.shared.domain.NoAutorizadoException("La sesión no tiene usuario asociado");
        }
        return id;
    }
}
