import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Gestioncontratacion } from './gestioncontratacion';

describe('Gestioncontratacion', () => {
  let component: Gestioncontratacion;
  let fixture: ComponentFixture<Gestioncontratacion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Gestioncontratacion],
    }).compileComponents();

    fixture = TestBed.createComponent(Gestioncontratacion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
