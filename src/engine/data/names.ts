/**
 * Name pools for generated (fictional) players. Compiled by Pitchborn from
 * common given names and surnames; combinations are random so generated
 * players are fictional and do not represent real people.
 */
export interface NamePool {
  first: string[];
  last: string[];
}

const p = (first: string, last: string): NamePool => ({
  first: first.split(" "),
  last: last.split(" "),
});

export const NAME_POOLS: Record<string, NamePool> = {
  english: p(
    "Jack Harry George Oliver Charlie James Thomas Alfie Joshua Daniel Samuel Joseph Ben Lewis Ryan Callum Kieran Jordan Mason Tyler Reece Luke Ethan Jake Liam Connor Nathan Aaron Owen Max Toby Archie Freddie Leo Jamie Harvey Bradley Kyle",
    "Smith Jones Taylor Brown Williams Wilson Johnson Davies Robinson Wright Thompson Evans Walker White Roberts Green Hall Wood Jackson Clarke Turner Hill Moore Cooper Ward Morris King Watson Baker Harrison Parker Bennett Hughes Carter Mitchell Shaw Lloyd Barnes Fletcher Holmes Webb Palmer Gibson Ellis Knight Stone Marsh Hayes Fox Barker",
  ),
  welsh: p(
    "Gareth Rhys Dafydd Owain Aaron Ben Joe Harry Ethan Kieffer Brennan Neco Connor Dylan Iwan Morgan Jordan Tom Elis Cai",
    "Jones Davies Williams Evans Thomas Roberts Hughes Lewis Morgan Griffiths Price Rees Jenkins Owen Powell Pritchard Vaughan Bowen Llewellyn Parry",
  ),
  irish: p(
    "Sean Conor Cian Darragh Oisin Eoin Ronan Shane Niall Ciaran Liam Aidan Callum Jamie Ryan Dara Fionn Cillian Kevin Declan",
    "Murphy Kelly O'Brien Byrne Ryan O'Connor Walsh McCarthy O'Sullivan Doyle McLaughlin Brennan Kavanagh Gallagher Nolan Quinn Boyle Duffy Keane Fitzgerald",
  ),
  spanish: p(
    "Alejandro Pablo Daniel Javier Sergio Adrián Álvaro Diego Hugo Mario Iker Marcos Raúl Rubén Carlos David Jorge Miguel Unai Aitor Íñigo Pedro Gonzalo Martín Lucas Nico Dani Óscar Víctor Borja Fermín Rodrigo Héctor Asier",
    "García Fernández González Rodríguez López Martínez Sánchez Pérez Gómez Martín Jiménez Ruiz Hernández Díaz Moreno Muñoz Álvarez Romero Alonso Gutiérrez Navarro Torres Domínguez Vázquez Ramos Gil Ramírez Serrano Blanco Molina Morales Suárez Ortega Delgado Castro Ortiz Rubio Marín Sanz Iglesias Herrera Peña Cabrera Vidal Campos Fuentes Carrasco Prieto",
  ),
  german: p(
    "Lukas Leon Finn Jonas Luca Paul Felix Niklas Tim Jan Maximilian Julian Moritz Florian Tobias Kai Marco Timo Joshua Robin Kevin Nico Dominik Benjamin Sebastian Philipp Lars Erik Jannik Malte Ole Henrik",
    "Müller Schmidt Schneider Fischer Weber Meyer Wagner Becker Schulz Hoffmann Koch Richter Klein Wolf Schröder Neumann Schwarz Braun Zimmermann Krüger Hartmann Lange Werner Krause Lehmann Köhler Herrmann König Walter Mayer Huber Kaiser Fuchs Peters Lang Scholz Möller Weiß Jung Hahn Vogel Keller Frank Berger Winkler Roth Beck Lorenz Baumann Franke",
  ),
  italian: p(
    "Francesco Alessandro Lorenzo Matteo Andrea Gabriele Leonardo Riccardo Davide Tommaso Giuseppe Federico Marco Luca Simone Nicolò Giacomo Pietro Stefano Daniele Antonio Christian Filippo Manuel Gianluca Alessio Mattia Samuele Edoardo Emanuele Giovanni Sandro Ciro Raoul Fabio",
    "Rossi Russo Ferrari Esposito Bianchi Romano Colombo Ricci Marino Greco Bruno Gallo Conti De Luca Mancini Costa Giordano Rizzo Lombardi Moretti Barbieri Fontana Santoro Mariani Rinaldi Caruso Ferrara Galli Martini Leone Longo Gentile Martinelli Vitale Lombardo Serra Coppola De Santis Pellegrini Marchetti Parisi Villa Cattaneo Fabbri Bellini Orlando Sala Monti",
  ),
  french: p(
    "Lucas Hugo Théo Louis Nathan Enzo Mathis Gabriel Raphaël Arthur Jules Tom Maxime Antoine Paul Adrien Baptiste Clément Florian Benjamin Thomas Alexandre Romain Quentin Valentin Bastien Aurélien Rayan Mathéo Yanis Noah Malo Warren",
    "Martin Bernard Dubois Thomas Robert Richard Petit Durand Leroy Moreau Simon Laurent Lefebvre Michel Garcia David Bertrand Roux Vincent Fournier Morel Girard André Lefèvre Mercier Dupont Lambert Bonnet François Martinez Legrand Garnier Faure Rousseau Blanc Guerin Muller Henry Roussel Nicolas Perrin Morin Mathieu Clément Gauthier Dumont Lopez Fontaine Chevalier Robin",
  ),
  portuguese: p(
    "João Rúben Diogo Bruno Bernardo Rafael Gonçalo Tiago Pedro Nuno André Ricardo Francisco Rodrigo Miguel Duarte Afonso Tomás Martim Henrique Fábio Nélson Renato",
    "Silva Santos Ferreira Pereira Oliveira Costa Rodrigues Martins Jesus Sousa Fernandes Gonçalves Gomes Lopes Marques Alves Almeida Ribeiro Pinto Carvalho Teixeira Moreira Correia Mendes Nunes Soares Vieira Monteiro Cardoso Rocha Neves Coelho Cruz Leão Palhinha",
  ),
  dutch: p(
    "Daan Sem Levi Lucas Finn Milan Jesse Thijs Bram Lars Ruben Stijn Joey Kevin Jurriën Teun Xavi Wout Cody Denzel Micky Arne Thibaut Lander Dries",
    "de Jong Jansen de Vries van den Berg van Dijk Bakker Janssen Visser Smit Meijer de Boer Mulder de Groot Bos Vos Peters Hendriks van Leeuwen Dekker Brouwer de Wit Dijkstra Smits de Graaf van der Meer Kok Jacobs de Haan Vermeulen van den Heuvel Peeters Maes Claes Wouters Goossens De Smet",
  ),
  nordic: p(
    "Erik Lars Anders Magnus Mikkel Rasmus Kasper Oscar Emil Viktor Isak Jonas Martin Sander Kristoffer Alexander Mathias Andreas Joakim Christian Elias Noah Felix Oliver William Hugo Filip Linus Pontus Jesper",
    "Hansen Johansen Olsen Larsen Andersen Pedersen Nilsen Kristiansen Jensen Karlsen Johansson Andersson Karlsson Nilsson Eriksson Larsson Olsson Persson Svensson Gustafsson Pettersson Jonsson Lindberg Lindqvist Berg Haugen Dahl Lund Holm Strand",
  ),
  polish: p(
    "Jakub Kacper Szymon Mateusz Filip Bartosz Michał Wojciech Kamil Piotr Tomasz Krzysztof Łukasz Adam Patryk Dominik Tomáš Ondřej Lukáš Ivan Oleksandr Andriy Mykola Petro Artem Viktor",
    "Nowak Kowalski Wiśniewski Wójcik Kowalczyk Kamiński Lewandowski Zieliński Szymański Woźniak Dąbrowski Kozłowski Jankowski Mazur Kwiatkowski Krawczyk Piotrowski Grabowski Novák Svoboda Dvořák Černý Procházka Kovalenko Bondarenko Shevchenko Tkachenko Kravchenko Melnyk Boyko",
  ),
  balkan: p(
    "Luka Ivan Marko Josip Mateo Ante Dario Nikola Stefan Dušan Aleksandar Filip Petar Mario Domagoj Andrej Lovro Sergej Strahinja Vanja Bruno Toni Duje Mislav",
    "Horvat Kovačević Babić Marić Jurić Novak Knežević Vuković Marković Petrović Jovanović Nikolić Ilić Đorđević Stojanović Pavlović Popović Lukić Šarić Božić Radić Grgić Matić Filipović Vidović Tomić Bošnjak Pavić Barišić Kolar",
  ),
  turkish: p(
    "Mehmet Mustafa Ahmet Ali Hüseyin Hasan Emre Burak Cengiz Kerem Arda Hakan Ozan Kaan Yusuf Enes Barış Orkun Ferdi Semih Abdülkerim Mert İrfan Okay",
    "Yılmaz Kaya Demir Şahin Çelik Yıldız Yıldırım Öztürk Aydın Özdemir Arslan Doğan Kılıç Aslan Çetin Kara Koç Kurt Özkan Şimşek Polat Korkmaz Güler Ünal Akgün Erdem Aksoy Tekin Bulut",
  ),
  brazilian: p(
    "Gabriel Lucas Matheus Pedro Rafael Vinícius Bruno Felipe Gustavo João Thiago Rodrigo Eduardo Caio Igor Danilo Éder Renan Wesley Gerson Fábio Marcos Paulo Anderson Andreas Douglas",
    "Silva Santos Oliveira Souza Lima Pereira Costa Rodrigues Almeida Nascimento Araújo Ferreira Ribeiro Carvalho Gomes Martins Barbosa Rocha Dias Moura Cavalcanti Teixeira Correia Monteiro Mendes Freitas Barros Pinto Moreira Cardoso Vieira Nunes Batista Fonseca Machado",
  ),
  latin: p(
    "Santiago Mateo Sebastián Matías Nicolás Joaquín Benjamín Tomás Emiliano Facundo Julián Enzo Rodrigo Alexis Giovani Luis Juan Carlos Jesús Raúl Edson Ronald Federico Darwin James Jhon Yerry Davinson Luis Andrés Cristian",
    "González Rodríguez Gómez Fernández López Díaz Martínez Pérez García Sánchez Romero Sosa Álvarez Torres Ruiz Ramírez Flores Acosta Benítez Medina Herrera Suárez Aguirre Giménez Gutiérrez Pereyra Rojas Molina Castro Ortiz Silva Núñez Luna Juárez Cabrera Ríos Vargas Mora Castillo Valencia Arias",
  ),
  american: p(
    "Tyler Christian Weston Gio Brenden Josh Matt Zack Jordan Antonee Sergiño Ricardo Malik Chris Walker DeAndre Paxten Folarin Alphonso Jonathan Cyle Tajon Ismael Kamal Stephen Derek",
    "Adams Anderson Turner Morris Robinson Davis Miller Wright Brooks Bradley Howard Richards Long Campbell Collins Edwards Foster Graham Hayes Jenkins Kelly Murphy Peterson Reed Ross Sullivan Tucker Walsh Young Bailey",
  ),
  westafrican: p(
    "Ousmane Idrissa Malick Ismaïla Moussa Cheikh Pape Mamadou Ibrahima Abdoulaye Lamine Nicolas Franck Serge Wilfried Sébastien Simon Jean-Philippe André Vincent Thomas Mohammed Kwame Kofi Jordan Inaki Bryan Karl",
    "Gueye Sarr Diallo Ndiaye Cissé Diop Sow Fall Seck Faye Ba Niang Touré Traoré Kamara Bamba Koné Coulibaly Ouattara Yao Kouassi Konan Mensah Owusu Boateng Asante Appiah Ngono Mbarga Essomba Fotso Nkoulou Tchami",
  ),
  nigerian: p(
    "Victor Ademola Samuel Wilfred Calvin Kelechi Alex Ahmed Moses Taiwo Ola Frank Joe Raphael Chidera Tolu Kenneth Bright Paul Semi Femi Chukwuemeka",
    "Okafor Adeyemi Eze Nwankwo Obi Okonkwo Adebayo Balogun Ogunleye Chukwu Nwosu Okeke Ibrahim Bello Afolabi Akinola Oyelaran Emenike Udeh Onyekachi Agu Olawale Ojo Ilori Uche",
  ),
  maghreb: p(
    "Ayoub Hamza Youssef Sofyan Azzedine Noussair Bilal Ilias Brahim Amine Riyad Ismaël Saïd Ramy Mohamed Omar Mahmoud Ahmed Karim Yacine Houssem Rayan Nayef Adam",
    "Benali El Amrani Idrissi Bennani Alaoui Tazi Berrada Chraibi Lahlou Haddad Belkacem Bouzid Mansouri Saidi Brahimi Meziane Cherif Hamdi Mostafa Fathi Hassan Mahmoud Fawzi Gamal Nasser Rachidi",
  ),
  japanese: p(
    "Takumi Kaoru Takefusa Wataru Daichi Ritsu Junya Kou Hiroki Takehiro Ayase Kyogo Daizen Yukinari Shogo Ao Keito Reo Yuito Hidemasa Kento Sota Haruto Ren",
    "Sato Tanaka Nakamura Morita Suzuki Takahashi Watanabe Yamamoto Kobayashi Kato Yoshida Sasaki Matsumoto Inoue Kimura Hayashi Shimizu Yamada Mori Ikeda Hashimoto Ishikawa Ogawa Fujita Okada Goto Hasegawa Murakami Kondo Ishii",
  ),
  korean: p(
    "Min-jun Seo-jun Do-yun Ye-jun Si-woo Ha-jun Joo-won Ji-ho Ji-hoon Jun-seo Hyun-woo Dong-hyun Sung-min Tae-yang Jae-won Woo-jin Min-seok Chang-min",
    "Son Lee Kim Hwang Cho Paik Jeong Park Choi Jung Kang Yoon Jang Lim Han Oh Seo Shin Kwon Hong Song Jeon Ko Moon",
  ),
};

export function poolFor(key: string): NamePool {
  return NAME_POOLS[key] ?? NAME_POOLS.english;
}
