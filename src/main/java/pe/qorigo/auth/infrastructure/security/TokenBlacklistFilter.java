package pe.qorigo.auth.infrastructure.security;

import jakarta.annotation.Priority;
import jakarta.inject.Inject;
import jakarta.ws.rs.NotAuthorizedException;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.ext.Provider;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Provider
@Priority(Priorities.AUTHORIZATION)
public class TokenBlacklistFilter implements ContainerRequestFilter {

    @Inject
    TokenBlacklist blacklist;

    @Inject
    JsonWebToken jwt;

    @Override
    public void filter(ContainerRequestContext requestContext) {
        if (requestContext.getSecurityContext().getUserPrincipal() == null) {
            return;
        }
        try {
            Object jti = jwt.getClaim("jti");
            if (jti != null && blacklist.bloqueado(jti.toString())) {
                throw new NotAuthorizedException("Sesión cerrada", "Bearer");
            }
        } catch (IllegalStateException ignored) {
            // Petición sin token JWT: el control de acceso estándar decide.
        }
    }
}
