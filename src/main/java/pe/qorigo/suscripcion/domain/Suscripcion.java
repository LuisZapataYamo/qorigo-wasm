package pe.qorigo.suscripcion.domain;

import pe.qorigo.shared.domain.Dinero;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record Suscripcion(
        Long idSuscripcion,
        Long idPlataforma,
        String moneda,
        String nombre,
        BigDecimal costo,
        String periodicidad,
        int capacidad,
        int diaCobro,
        LocalDate fechaInicio,
        EstadoSuscripcion estado,
        Instant creadoEn
) {
    public BigDecimal costoPorPlaza() {
        if (capacidad <= 0) {
            return Dinero.cero();
        }
        return Dinero.dividir(costo, BigDecimal.valueOf(capacidad), Dinero.ESCALA);
    }

    public boolean activa() {
        return estado != null && estado.activa();
    }
}
