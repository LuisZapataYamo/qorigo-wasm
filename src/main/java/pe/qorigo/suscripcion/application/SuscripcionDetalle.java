package pe.qorigo.suscripcion.application;

import pe.qorigo.shared.domain.Dinero;
import pe.qorigo.suscripcion.domain.Suscripcion;

import java.math.BigDecimal;

public record SuscripcionDetalle(
        Suscripcion suscripcion,
        int plazasOcupadas,
        int plazasLibres,
        BigDecimal costoPorPlaza,
        BigDecimal cobertura,
        boolean alertaDeficit
) {
    public static SuscripcionDetalle de(Suscripcion suscripcion, ResumenMiembros resumen) {
        int ocupadas = (int) Math.min(Integer.MAX_VALUE, resumen.activos());
        int libres = Math.max(0, suscripcion.capacidad() - ocupadas);
        BigDecimal cobertura = ocupadas == 0
                ? Dinero.cero()
                : Dinero.restar(resumen.totalAcordado(), suscripcion.costo());
        return new SuscripcionDetalle(
                suscripcion,
                ocupadas,
                libres,
                suscripcion.costoPorPlaza(),
                cobertura,
                cobertura.signum() < 0);
    }
}
