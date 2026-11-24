package pe.qorigo.auth.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import pe.qorigo.auth.domain.RecuperacionPassword;
import pe.qorigo.auth.domain.Usuario;
import pe.qorigo.shared.application.Reloj;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

@ApplicationScoped
public class RecuperarPasswordUseCase {

    private static final String MENSAJE_GENERICO =
            "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña";

    @Inject
    UsuarioRepository usuarios;

    @Inject
    RecuperacionPasswordRepository recuperaciones;

    @Inject
    Reloj reloj;

    @ConfigProperty(name = "qorigo.auth.minutos-token-recuperacion", defaultValue = "30")
    long minutosVigencia;

    @ConfigProperty(name = "qorigo.auth.exponer-token-recuperacion", defaultValue = "false")
    boolean exponerToken;

    private final SecureRandom random = new SecureRandom();

    @Transactional
    public RecuperacionSolicitada ejecutar(String email) {
        Optional<Usuario> usuario = usuarios.buscarPorEmail(email);
        if (usuario.isEmpty() || !usuario.get().puedeIniciarSesion()) {
            return new RecuperacionSolicitada(MENSAJE_GENERICO, null);
        }

        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        recuperaciones.invalidarPendientes(usuario.get().idUsuario());
        RecuperacionPassword recuperacion = new RecuperacionPassword(
                null,
                usuario.get().idUsuario(),
                sha256(token),
                reloj.ahora().plus(Duration.ofMinutes(minutosVigencia)),
                false,
                reloj.ahora());
        recuperaciones.guardar(recuperacion);

        return new RecuperacionSolicitada(MENSAJE_GENERICO, exponerToken ? token : null);
    }

    public static String sha256(String valor) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(valor.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo calcular SHA-256", e);
        }
    }

    public record RecuperacionSolicitada(String mensaje, String token) {
    }
}
