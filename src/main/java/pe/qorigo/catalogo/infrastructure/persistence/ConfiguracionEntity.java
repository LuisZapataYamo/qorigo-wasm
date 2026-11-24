package pe.qorigo.catalogo.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "configuracion")
public class ConfiguracionEntity {

    @Id
    @Column(name = "clave", length = 60)
    private String clave;

    @Column(name = "valor", nullable = false, length = 250)
    private String valor;

    public String getClave() {
        return clave;
    }

    public void setClave(String clave) {
        this.clave = clave;
    }

    public String getValor() {
        return valor;
    }

    public void setValor(String valor) {
        this.valor = valor;
    }
}
