package pe.qorigo.auth.application;

import pe.qorigo.auth.domain.RecuperacionPassword;

import java.util.Optional;

public interface RecuperacionPasswordRepository {

    RecuperacionPassword guardar(RecuperacionPassword recuperacion);

    Optional<RecuperacionPassword> buscarPorTokenHash(String tokenHash);

    void marcarUsado(Long idRecuperacion);

    void invalidarPendientes(Long idUsuario);
}
