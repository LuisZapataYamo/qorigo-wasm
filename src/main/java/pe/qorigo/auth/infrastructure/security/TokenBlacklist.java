package pe.qorigo.auth.infrastructure.security;

import jakarta.enterprise.context.ApplicationScoped;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class TokenBlacklist {

    private final Map<String, Instant> bloqueados = new ConcurrentHashMap<>();

    public void bloquear(String jti, Instant expiraEn) {
        if (jti != null) {
            bloqueados.put(jti, expiraEn == null ? Instant.now().plusSeconds(3600) : expiraEn);
        }
    }

    public boolean bloqueado(String jti) {
        if (jti == null) {
            return false;
        }
        Instant expira = bloqueados.get(jti);
        if (expira == null) {
            return false;
        }
        if (expira.isBefore(Instant.now())) {
            bloqueados.remove(jti);
            return false;
        }
        return true;
    }

    public void limpiar() {
        bloqueados.clear();
    }
}
