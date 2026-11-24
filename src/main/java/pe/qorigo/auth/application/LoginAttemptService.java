package pe.qorigo.auth.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import pe.qorigo.shared.application.Reloj;
import pe.qorigo.shared.domain.LimiteIntentosException;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class LoginAttemptService {

    @ConfigProperty(name = "qorigo.auth.max-intentos", defaultValue = "5")
    int maxIntentos;

    @ConfigProperty(name = "qorigo.auth.ventana-bloqueo-minutos", defaultValue = "15")
    long ventanaMinutos;

    @Inject
    Reloj reloj;

    private final Map<String, Registro> registros = new ConcurrentHashMap<>();

    public void verificarPermitido(String email) {
        Registro registro = registros.get(clave(email));
        if (registro != null && registro.bloqueadoHasta != null && registro.bloqueadoHasta.isAfter(reloj.ahora())) {
            throw new LimiteIntentosException("Demasiados intentos fallidos. Intenta nuevamente en unos minutos.");
        }
    }

    public void registrarFallo(String email) {
        registros.compute(clave(email), (k, actual) -> {
            Registro registro = actual == null ? new Registro() : actual;
            registro.intentos++;
            if (registro.intentos >= maxIntentos) {
                registro.bloqueadoHasta = reloj.ahora().plus(Duration.ofMinutes(ventanaMinutos));
            }
            return registro;
        });
    }

    public void registrarExito(String email) {
        registros.remove(clave(email));
    }

    public void limpiar() {
        registros.clear();
    }

    private String clave(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private static final class Registro {
        private int intentos;
        private Instant bloqueadoHasta;
    }
}
