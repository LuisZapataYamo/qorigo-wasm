package pe.qorigo.auth.application;

public interface PasswordHasher {

    String hash(String password);

    boolean verifica(String password, String hash);
}
