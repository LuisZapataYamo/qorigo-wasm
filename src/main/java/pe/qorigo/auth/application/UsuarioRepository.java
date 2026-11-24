package pe.qorigo.auth.application;

import pe.qorigo.auth.domain.Usuario;

import java.util.Optional;

public interface UsuarioRepository {

    Optional<Usuario> buscarPorEmail(String email);

    Optional<Usuario> buscarPorId(Long idUsuario);

    Optional<Usuario> buscarPorPersona(Long idPersona);

    boolean existeEmail(String email);

    Usuario guardar(Usuario usuario);

    void actualizarPasswordHash(Long idUsuario, String passwordHash);

    void actualizarActivo(Long idUsuario, boolean activo);
}
