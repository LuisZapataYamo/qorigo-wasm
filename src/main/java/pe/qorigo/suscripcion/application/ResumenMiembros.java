package pe.qorigo.suscripcion.application;

import java.math.BigDecimal;

public record ResumenMiembros(long activos, BigDecimal totalAcordado) {

    public static ResumenMiembros vacio() {
        return new ResumenMiembros(0, BigDecimal.ZERO);
    }
}
