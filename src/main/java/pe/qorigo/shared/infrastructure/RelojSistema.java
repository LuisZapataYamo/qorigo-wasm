package pe.qorigo.shared.infrastructure;

import jakarta.enterprise.context.ApplicationScoped;
import pe.qorigo.shared.application.Reloj;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

@ApplicationScoped
public class RelojSistema implements Reloj {

    private static final ZoneId ZONA = ZoneId.of("America/Lima");

    @Override
    public Instant ahora() {
        return Instant.now();
    }

    @Override
    public LocalDate hoy() {
        return LocalDate.now(ZONA);
    }
}
