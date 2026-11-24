package pe.qorigo.shared.infrastructure.security;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.RequestScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.jwt.JsonWebToken;
import pe.qorigo.shared.application.CurrentUser;

@RequestScoped
public class CurrentUserJwt implements CurrentUser {

    @Inject
    SecurityIdentity identity;

    @Inject
    JsonWebToken jwt;

    @Override
    public Long idUsuario() {
        if (identity.isAnonymous()) {
            return null;
        }
        return numero(jwt.getClaim("id_usuario"));
    }

    @Override
    public Long idPersona() {
        if (identity.isAnonymous()) {
            return null;
        }
        return numero(jwt.getClaim("id_persona"));
    }

    @Override
    public String email() {
        if (identity.isAnonymous()) {
            return null;
        }
        String claim = jwt.getClaim("email");
        return claim != null ? claim : jwt.getName();
    }

    @Override
    public String rol() {
        if (identity.isAnonymous()) {
            return null;
        }
        return identity.getRoles().stream()
                .filter(r -> "ADMIN".equals(r) || "MEMBER".equals(r))
                .findFirst()
                .orElse(null);
    }

    private Long numero(Object valor) {
        if (valor == null) {
            return null;
        }
        if (valor instanceof Number n) {
            return n.longValue();
        }
        return Long.valueOf(valor.toString());
    }
}
