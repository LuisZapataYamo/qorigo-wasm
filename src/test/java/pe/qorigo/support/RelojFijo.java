package pe.qorigo.support;

import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import pe.qorigo.shared.application.Reloj;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

@Alternative
@Priority(1)
@ApplicationScoped
public class RelojFijo implements Reloj {

    private static final ZoneId LIMA = ZoneId.of("America/Lima");
    private static volatile LocalDate fecha = LocalDate.of(2026, 11, 24);

    public static void fijar(LocalDate nuevaFecha) {
        fecha = nuevaFecha;
    }

    public static LocalDate fecha() {
        return fecha;
    }

    @Override
    public Instant ahora() {
        return fecha.atTime(12, 0).atZone(LIMA).toInstant();
    }

    @Override
    public LocalDate hoy() {
        return fecha;
    }
}
