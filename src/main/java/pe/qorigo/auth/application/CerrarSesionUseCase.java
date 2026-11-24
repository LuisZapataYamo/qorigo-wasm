package pe.qorigo.auth.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import pe.qorigo.auth.infrastructure.security.TokenBlacklist;

import java.time.Instant;

@ApplicationScoped
public class CerrarSesionUseCase {

    @Inject
    TokenBlacklist blacklist;

    public void ejecutar(String jti, Instant expiraEn) {
        blacklist.bloquear(jti, expiraEn);
    }
}
