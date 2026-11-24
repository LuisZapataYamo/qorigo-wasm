package pe.qorigo.auth.infrastructure.security;

import io.smallrye.jwt.build.Jwt;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import pe.qorigo.auth.application.EmisorToken;
import pe.qorigo.auth.domain.Usuario;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@ApplicationScoped
public class JwtEmisorToken implements EmisorToken {

    @ConfigProperty(name = "qorigo.auth.horas-token", defaultValue = "12")
    long horasToken;

    @Override
    public TokenEmitido emitir(Usuario usuario) {
        String jti = UUID.randomUUID().toString();
        Instant expiraEn = Instant.now().plus(Duration.ofHours(horasToken));
        String token = Jwt.issuer("qorigo-api")
                .subject(usuario.emailLogin())
                .upn(usuario.emailLogin())
                .groups(usuario.rol().name())
                .claim("email", usuario.emailLogin())
                .claim("id_usuario", usuario.idUsuario())
                .claim("id_persona", usuario.idPersona())
                .claim("jti", jti)
                .expiresAt(expiraEn.getEpochSecond())
                .sign();
        return new TokenEmitido(token, expiraEn, jti);
    }
}
