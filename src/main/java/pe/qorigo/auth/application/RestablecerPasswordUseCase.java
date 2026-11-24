package pe.qorigo.auth.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import pe.qorigo.auth.domain.RecuperacionPassword;
import pe.qorigo.auth.domain.Usuario;
import pe.qorigo.shared.application.AuditoriaPort;
import pe.qorigo.shared.application.Reloj;
import pe.qorigo.shared.domain.ValidacionException;

import java.time.Instant;
import java.util.Map;

@ApplicationScoped
public class RestablecerPasswordUseCase {

    @Inject
    RecuperacionPasswordRepository recuperaciones;

    @Inject
    UsuarioRepository usuarios;

    @Inject
    PasswordHasher passwordHasher;

    @Inject
    Reloj reloj;

    @Inject
    AuditoriaPort auditoria;

    @Transactional
    public void ejecutar(String token, String nuevaPassword) {
        String hash = RecuperarPasswordUseCase.sha256(token == null ? "" : token.trim());
        RecuperacionPassword recuperacion = recuperaciones.buscarPorTokenHash(hash)
                .orElseThrow(() -> ValidacionException.conCodigo("TOKEN_INVALIDO", "El enlace es inválido o venció"));

        Instant ahora = reloj.ahora();
        if (!recuperacion.vigente(ahora)) {
            throw ValidacionException.conCodigo("TOKEN_INVALIDO", "El enlace es inválido o venció");
        }

        Usuario usuario = usuarios.buscarPorId(recuperacion.idUsuario())
                .orElseThrow(() -> ValidacionException.conCodigo("TOKEN_INVALIDO", "El enlace es inválido o venció"));
        if (!usuario.activo()) {
            throw ValidacionException.conCodigo("TOKEN_INVALIDO", "El enlace es inválido o venció");
        }

        usuarios.actualizarPasswordHash(usuario.idUsuario(), passwordHasher.hash(nuevaPassword));
        recuperaciones.marcarUsado(recuperacion.idRecuperacion());
        auditoria.registrar("USUARIO", usuario.idUsuario(), "RESTABLECER_PASSWORD", null,
                Map.of("metodo", "token_recuperacion"));
    }
}
