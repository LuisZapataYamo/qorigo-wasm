package pe.qorigo.auth.infrastructure.security;

import at.favre.lib.crypto.bcrypt.BCrypt;
import jakarta.enterprise.context.ApplicationScoped;
import pe.qorigo.auth.application.PasswordHasher;

@ApplicationScoped
public class BcryptPasswordHasher implements PasswordHasher {

    private static final int COSTO = 10;

    @Override
    public String hash(String password) {
        return BCrypt.withDefaults().hashToString(COSTO, password.toCharArray());
    }

    @Override
    public boolean verifica(String password, String hash) {
        if (password == null || hash == null) {
            return false;
        }
        return BCrypt.verifyer().verify(password.toCharArray(), hash).verified;
    }
}
