package pe.qorigo.auth.domain;

public enum Rol {
    ADMIN,
    MEMBER;

    public static Rol desde(String valor) {
        if (valor == null || valor.isBlank()) {
            return MEMBER;
        }
        try {
            return Rol.valueOf(valor.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new pe.qorigo.shared.domain.ValidacionException("rol", "Rol inválido: " + valor);
        }
    }
}
