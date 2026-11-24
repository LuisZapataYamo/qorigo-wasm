package pe.qorigo.auth.application;

import pe.qorigo.auth.domain.Usuario;

import java.time.Instant;

public interface EmisorToken {

    TokenEmitido emitir(Usuario usuario);

    record TokenEmitido(String token, Instant expiraEn, String jti) {
    }
}
